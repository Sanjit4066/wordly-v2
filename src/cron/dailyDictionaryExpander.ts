/**
 * dailyDictionaryExpander.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Autonomous daily cron job — runs at 5:00 AM EST (10:00 AM UTC) every day.
 *
 * What it does:
 *   1. Waits for any pending user-requested words to finish processing first
 *   2. Then works through the master word list, picking up to BATCH_SIZE words
 *      that are NOT yet in the dictionary
 *   3. Calls Gemini AI for each word — generates meaning, 2 sentences, level,
 *      synonyms, antonyms, and etymology
 *   4. Saves each word to the dictionary with addedVia: 'ai_batch'
 *   5. Logs a full summary when done
 *
 * Rate limiting:
 *   - 1 word every DELAY_MS milliseconds  ≈ 13 RPM (under Gemini free tier)
 *   - Built-in retry with exponential back-off for 429 errors
 *   - At 4.5 s/word: 1000 words ≈ 75 minutes
 *
 * Schedule: '0 10 * * *'  →  10:00 AM UTC  =  5:00 AM EST / 6:00 AM EDT
 * ─────────────────────────────────────────────────────────────────────────────
 */

import cron from 'node-cron';
import Word from '../models/Dictionary';
import WordRequest from '../models/WordRequests';
import { processWordWithAI, processWordsBatchWithAI } from '../services/geminiService';
import { DifficultyLevel } from '../models/Dictionary';

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const BATCH_SIZE = 600;       // max words to process per daily run (20 reqs * 30 words = 600)
const CHUNK_SIZE = 30;        // words per single Gemini AI call
const DELAY_MS   = 10000;     // ms between each chunk (rate limiting)
const MAX_PENDING_WAIT_MS = 10 * 60 * 1000; // wait up to 10 min for user-requests to clear

// ─── MASTER WORD LIST ────────────────────────────────────────────────────────
// 1000+ curated English words across all difficulty levels.
// Words already in the dictionary are automatically skipped.
const MASTER_WORD_LIST: string[] = [
  // ── BEGINNER ──────────────────────────────────────────────────────────────
  'able','accept','act','add','afraid','after','again','age','ago','agree',
  'air','all','allow','also','always','angry','animal','answer','any','area',
  'ask','baby','back','bad','bag','ball','bank','base','bath','bear',
  'beat','become','begin','believe','belong','best','big','bird','black','block',
  'blood','blow','blue','body','book','born','both','box','boy','break',
  'bring','brother','build','burn','buy','call','care','carry','catch','cause',
  'change','cheap','check','child','city','class','clean','clear','climb','close',
  'cold','come','cook','cool','copy','cost','count','cover','cry','cut',
  'dark','day','dead','deal','deep','deny','describe','die','different','difficult',
  'dirt','door','draw','dream','drink','drive','drop','dry','each','early',
  'earn','easy','eat','end','enter','even','every','example','face','fact',
  'fail','fall','family','far','fast','fat','feel','few','fight','find',
  'finish','fire','fish','fix','fly','follow','food','forget','form','found',
  'free','friend','full','fun','game','get','give','glad','good','great',
  'green','grow','guess','hand','hang','hard','hate','have','head','hear',
  'heart','heat','help','high','hold','home','hope','hot','house','hurt',
  'idea','important','include','increase','inside','interest','jump','keep','kill','kind',
  'know','large','last','late','laugh','lay','lead','learn','leave','left',
  'let','life','lift','light','like','list','listen','little','live','long',
  'look','lose','lot','love','low','make','man','many','mark','matter',
  'mean','meet','mind','miss','mix','money','month','more','move','much',
  'need','never','next','nice','night','north','note','offer','often','once',
  'open','order','other','over','own','pain','pass','pay','people','pick',
  'place','plan','play','point','power','put','quick','quiet','rain','raise',
  'reach','read','ready','real','rest','right','rise','road','round','rule',
  'run','safe','same','save','say','see','seem','send','set','show',
  'side','sit','size','sky','sleep','slow','small','smell','smile','snow',
  'soft','some','soon','sorry','south','speak','stand','start','stay','still',
  'stop','strong','study','sun','sure','swim','take','talk','teach','tell',
  'think','throw','time','tired','together','touch','town','travel','tree','try',
  'turn','type','under','use','wait','walk','want','warm','wash','watch',
  'water','weak','wear','week','well','west','what','when','where','which',
  'while','wide','win','wind','wish','wonder','word','work','world','worry',
  'write','wrong','year','young',

  // ── INTERMEDIATE ──────────────────────────────────────────────────────────
  'abandon','abstract','achieve','acknowledge','acquire','adapt','adequate','adjacent','adjust','admire',
  'adopt','advance','advantage','adventure','advocate','affect','afford','aggressive','alert','allocate',
  'alter','ambition','analyze','ancient','announce','anticipate','apparent','appreciate','approach','appropriate',
  'approve','argue','arrange','assess','assign','assist','assume','attach','attempt','attract',
  'available','average','aware','balance','barrier','benefit','bias','boundary','capable','capture',
  'challenge','character','charge','choice','circumstance','claim','classify','collaborate','comment','commit',
  'communicate','compare','compete','complex','concentrate','concern','conclude','conflict','connect','consequence',
  'consider','consistent','constant','construct','contribute','control','convince','cooperate','coordinate','creative',
  'decline','define','delay','deliver','demonstrate','depend','develop','direct','discover','discuss',
  'display','distribute','disturb','diverse','dominant','dramatic','economic','effective','efficient','eliminate',
  'emerge','emphasize','enable','encourage','engage','enhance','enormous','establish','evaluate','evident',
  'evolve','examine','exclude','expand','experience','explain','explore','expose','express','extend',
  'factor','feature','flexible','focus','formal','foundation','generate','global','guide','identify',
  'ignore','impact','implement','imply','improve','indicate','individual','influence','inform','initiative',
  'innovate','insist','inspire','integrate','intense','involve','isolate','justify','logical','maintain',
  'manage','maximize','measure','mental','method','minimize','monitor','motivate','negotiate','numerous',
  'objective','observe','obtain','obvious','occur','operate','organize','overcome','participate','perceive',
  'perform','permit','persist','positive','potential','practical','predict','prepare','prevent','primary',
  'process','produce','professional','promote','propose','protect','provide','pursue','qualify','recognize',
  'reduce','reflect','relate','relevant','require','resolve','respond','restrict','retain','reveal',
  'review','revise','significant','similar','situation','solution','specify','stable','strategy','strengthen',
  'structure','submit','succeed','suggest','summarize','support','sustain','target','technique','temporary',
  'tendency','theory','transform','transition','transmit','trend','unique','update','utilize','validate',
  'vary','version','virtual','visible','voluntary','vulnerable','widespread','withdraw','witness','worthwhile',
  'accelerate','accumulate','accurate','activate','acute','adamant','adhere','affluent','articulate','authentic',
  'coherent','collaborative','compassionate','competent','comprehensive','confident','conscientious','conservative',
  'conventional','cooperative','courageous','creative','critical','decisive','dedicated','determined','diplomatic',
  'disciplined','dynamic','empathetic','enthusiastic','flexible','genuine','innovative','intellectual','methodical',

  // ── ADVANCED ──────────────────────────────────────────────────────────────
  'aberrant','abstruse','acrimony','acumen','adumbrate','aesthetic','affectation','aggrandize','alacrity','alienate',
  'allegory','alleviate','altruism','amalgamate','ambivalent','ameliorate','anachronism','anarchy','anecdote','anomaly',
  'antagonist','antipathy','apathy','apprehension','arcane','arduous','ascertain','assertion','assiduous','atrophy',
  'audacious','austere','authentic','avarice','aversion','axiom','benevolent','bombastic','brevity','bureaucracy',
  'callous','candid','capitulate','catalyst','caustic','charisma','chronological','circumspect','clandestine','coerce',
  'cognizant','cohesive','compelling','complacent','comprehensive','concise','condescend','convoluted','copious','corroborate',
  'credible','cryptic','culminate','cynical','debilitate','decipher','deficient','deliberate','delineate','demeaning',
  'deplore','derogatory','despondent','diligent','discrepancy','disdain','disparate','dissent','divergent','eccentric',
  'elaborate','eloquent','emulate','enigmatic','ephemeral','equivocal','eradicate','erroneous','esoteric','euphemism',
  'exacerbate','exorbitant','expedient','explicit','exuberant','fabricate','fallacious','fastidious','fervent','formidable',
  'forthright','frugal','futile','grandiose','gregarious','hamper','haphazard','hegemony','hierarchy','hypocrite',
  'hypothetical','ideological','imminent','impartial','impeccable','implicit','incisive','incongruous','indifferent','indignant',
  'indolent','inevitable','infallible','inherent','insinuate','integrity','intrinsic','intuitive','ironic','laconic',
  'latent','lethargic','lucid','malevolent','meticulous','mitigate','myopic','nonchalant','nostalgic','notorious',
  'nuanced','oblivious','ominous','opaque','optimistic','ostentatious','paradox','partisan','passive','patronize',
  'pedantic','pensive','pervasive','pessimistic','poignant','pragmatic','precarious','pretentious','prodigious','profound',
  'prolific','provocative','prudent','radiant','rationalize','reticent','rhetoric','rigorous','sarcastic','scrutinize',
  'serendipity','shrewd','skeptical','sophisticated','speculation','stoic','subjective','subtle','superficial','surplus',
  'sustainable','sympathetic','tangible','tenacious','theoretical','trivial','turbulent','ubiquitous','undermine','unequivocal',
  'unprecedented','vague','venerate','verbose','versatile','vindicate','volatile','zealous','admonish','adversarial',
  'affinity','aloof','altercation','amicable','anachronistic','apocryphal','arbitrary','ardor','ascetic','bellicose',
  'benefactor','blithe','boorish','bravado','bucolic','burgeon','capricious','censure','chagrin','chicanery',
  'clairvoyant','clemency','cognition','commensurate','compunction','conciliatory','condone','congenial','contentious','contrite',
  'culpable','dauntless','debonair','decorum','deferential','deft','deleterious','demagogue','denigrate','depravity',

  // ── EXPERT ────────────────────────────────────────────────────────────────
  'abeyance','abnegate','abscond','abstemious','accretion','acerbic','adamantine','aegis','afflatus','aggrandizement',
  'agonistic','aleatoric','amanuensis','ameliorate','analeptic','anamnesis','anfractuous','animadversion','antinomy','apocryphal',
  'apodictic','apogee','apophenia','apotheosis','apriorism','apposite','arabesque','arrogate','asperity','atavism',
  'atrabilious','autodidact','axiological','bathetic','brachylogy','cachinnate','calumny','casuistry','catachresis','chimerical',
  'clerisy','cognoscenti','concomitant','consanguinity','contumacious','cosmogony','cupidity','defalcation','defenestration','demiurge',
  'deracinate','desideratum','diatribe','didactic','dilettante','discomfit','discursive','disingenuous','dissimulate','dogmatic',
  'ebullient','effrontery','egregious','elegy','elision','emollient','empiricism','encomium','endemic','enervate',
  'ennui','episteme','equanimity','equivocate','erudite','eschatology','etiolate','etymology','eudaimonia','eulogize',
  'euphony','excoriate','execrate','exegesis','exiguous','expatiate','expiate','expunge','extirpate','fatuous',
  'felicitous','filibuster','flagitious','fulminate','garrulous','genuflect','grandiloquent','hagiography','harbinger','hermeneutics',
  'heterodox','heuristic','hubris','hypostasis','iconoclast','idiosyncrasy','ignominious','immutable','impecunious','imperious',
  'impugn','inchoate','ineluctable','inexorable','inimical','iniquitous','insouciance','interpolate','interregnum','inveterate',
  'irascible','jejune','juxtapose','lachrymose','lassitude','legerdemain','limerence','loquacious','lugubrious','machiavellian',
  'magnanimous','malapropism','melancholia','mendacious','mercurial','metaphysical','meretricious','misanthrope','mnemonic','moribund',
  'munificent','narcissism','neologism','nihilism','numinous','obdurate','obfuscate','obloquy','obstreperous','obsequious',
  'occlude','oligarchy','ontology','opprobrium','ostracize','palimpsest','panacea','panegyric','paradigm','pariah',
  'parlance','parsimonious','peccadillo','perfidious','peripatetic','peroration','perspicacious','pertinacious','petulant','phantasmagoria',
  'philistine','polemic','positivism','postulate','pragmatism','predilection','probity','proclivity','prolix','propitious',
  'proscribe','pulchritude','punctilious','quixotic','recalcitrant','recidivism','reification','remonstrate','reprobate','requite',
  'ruminate','sagacious','salutary','sanctimonious','sardonic','saturnine','schadenfreude','scintilla','semiotic','senescence',
  'sesquipedalian','sibilant','sinecure','solecism','solipsism','somnolent','sophistry','soporific','stigmatize','stolid',
  'subjugate','sycophant','synecdoche','taciturn','tautology','tendentious','tergiversate','timorous','torpid','tortuous',
  'transmogrify','trenchant','trepidation','truculent','turpitude','ululate','unctuous','undulate','usurp','vacuous',
  'venal','venial','verisimilitude','vitiate','vituperate','voluble','weltanschauung','xenophobia','zeitgeist','zealotry',
  'acedia','agnosticism','algolagnia','alieniloquy','antithesis','aphorism','apricity','ataraxia','bathos','bildungsroman',
  'boulevardier','callipygian','camelopard','catharsis','chrysalism','compathy','conundrum','crucible','defervescence','degringolade',
  'desiderium','diaphanous','dysphoria','echolalia','effulgent','eldritch','empirical','epiphany','eudaimonia','fernweh',
  'filament','fugacious','gauche','hiraeth','hyaline','immanent','incandescent','ineffable','ingenue','inscrutable',
  'iridescent','jadedness','kenopsia','lacuna','liminal','lissome','logophile','luminous','lurid','maudlin',
  'mellifluous','mercurial','merismus','metanoia','monachopsis','myrrh','nacreous','nascent','nebulous','noctiluca',
  'oleaginous','oneiric','opalescent','paracosm','pareidolia','parvenu','pathos','pellucid','perennial','petrichor',
  'phosphorescent','pluviophile','poignant','polyphony','proclivity','profundity','prosaic','pyrrhic','quiescent','raconteur',
  'recherche','redolent','refulgent','resplendent','rhapsodic','riparian','ruminant','sacrosanct','sempiternal','sensualism',
  'sonder','soporific','stelliferous','stillicide','strident','susurrus','syzygy','tenebrous','tessellate','thalassophile',
  'transient','tremulous','tristesse','tumult','umbrage','uncanny','undulation','vestigial','vicissitude','viridity',
  'viridian','visceral','vivacious','vortex','wanderlust','wistful','xenial','yugen','zephyr','zenith',
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const hours   = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts: string[] = [];
  if (hours   > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);
  return parts.join(' ');
}

/**
 * Wait until all user-requested words have been processed (or timeout).
 * This ensures the daily expander never competes with user-requested AI calls.
 */
async function waitForUserRequestsToFinish(): Promise<void> {
  const pollInterval = 30_000; // check every 30 s
  const deadline = Date.now() + MAX_PENDING_WAIT_MS;

  while (Date.now() < deadline) {
    const pendingCount = await WordRequest.countDocuments({
      status: { $in: ['pending', 'processing'] },
    });

    if (pendingCount === 0) {
      console.log('✅ [Expander] No pending user requests — starting daily expansion.');
      return;
    }

    console.log(`⏳ [Expander] ${pendingCount} user request(s) still processing. Waiting 30s...`);
    await delay(pollInterval);
  }

  console.warn('⚠️  [Expander] Timed out waiting for user requests. Proceeding anyway.');
}

// ─── CORE EXPANSION LOGIC ─────────────────────────────────────────────────────

async function runDailyExpansion(): Promise<void> {
  const startTime = Date.now();
  console.log('\n' + '═'.repeat(60));
  console.log('🌅 [Daily Expander] Starting 5:00 AM EST dictionary expansion run');
  console.log(`📅 ${new Date().toUTCString()}`);
  console.log('═'.repeat(60));

  // Step 1: Let user-requested word processing finish first
  await waitForUserRequestsToFinish();

  // Step 2: Find words from master list not yet in the dictionary
  const existingWords = await Word.distinct('word');
  const existingSet   = new Set<string>(existingWords);

  const toProcess = MASTER_WORD_LIST
    .map((w) => w.toLowerCase().trim())
    .filter((w) => !existingSet.has(w))
    .sort(() => Math.random() - 0.5) // Shuffle to ensure even distribution across all levels
    .slice(0, BATCH_SIZE);

  if (toProcess.length === 0) {
    console.log('✅ [Expander] All master-list words are already in the dictionary!');
    console.log('   Consider adding more words to MASTER_WORD_LIST in dailyDictionaryExpander.ts\n');
    return;
  }

  console.log(`\n📋 [Expander] ${toProcess.length} word(s) to process (batch cap: ${BATCH_SIZE})`);
  console.log(`⏱️  Rate: 1 word every ${DELAY_MS / 1000}s ≈ ${Math.round(60000 / DELAY_MS)} RPM`);
  const estMinutes = Math.ceil((toProcess.length * DELAY_MS) / 60000);
  console.log(`⏳ Estimated time: ~${estMinutes} minute(s)\n`);

  // Counters
  let inserted = 0;
  let skipped  = 0;
  let failed   = 0;
  const failedWords: string[] = [];

  // By-level breakdown
  const byLevel: Record<DifficultyLevel, number> = {
    beginner: 0, intermediate: 0, advanced: 0, expert: 0,
  };

  // Step 3: Process words in chunks
  for (let i = 0; i < toProcess.length; i += CHUNK_SIZE) {
    const chunk = toProcess.slice(i, i + CHUNK_SIZE);
    const progress = `[chunk ${Math.floor(i / CHUNK_SIZE) + 1}/${Math.ceil(toProcess.length / CHUNK_SIZE)}]`;

    // Filter out any words that were added by another process just now
    const chunkToProcess: string[] = [];
    for (const word of chunk) {
      if (await Word.exists({ word })) {
        skipped++;
      } else {
        chunkToProcess.push(word);
      }
    }

    if (chunkToProcess.length === 0) continue;

    try {
      process.stdout.write(`🤖 ${progress} Processing ${chunkToProcess.length} words... `);

      const aiDataArray = await processWordsBatchWithAI(chunkToProcess);

      for (const aiData of aiDataArray) {
        if (!aiData || !aiData.word) {
           failed++;
           continue;
        }
        await Word.create({
          word:        aiData.word.toLowerCase(),
          meaning:     aiData.meaning,
          sentences:   aiData.sentences,
          level:       aiData.level,
          synonyms:    aiData.synonyms,
          antonyms:    aiData.antonyms,
          etymology:   aiData.etymology,
          partOfSpeech: aiData.partOfSpeech,
          addedVia:    'ai_batch',
        });

        byLevel[aiData.level]++;
        inserted++;
      }
      process.stdout.write(`✅ saved!\n`);

      // Progress summary
      const elapsed   = Date.now() - startTime;
      const avgMs     = elapsed / (i + CHUNK_SIZE);
      const remainingChunks = Math.ceil((toProcess.length - (i + CHUNK_SIZE)) / CHUNK_SIZE);
      const etaMs     = remainingChunks * (avgMs * CHUNK_SIZE + DELAY_MS);
      console.log(`   📊 inserted:${inserted} skipped:${skipped} failed:${failed} | elapsed:${formatDuration(elapsed)} | eta:${formatDuration(etaMs)}\n`);

    } catch (err: any) {
      failed += chunkToProcess.length;
      failedWords.push(...chunkToProcess);
      process.stdout.write(`❌ FAILED — ${err.message?.slice(0, 80)}\n`);
    }

    // Rate-limit delay between chunks
    await delay(DELAY_MS);
  }

  // Step 4: Final summary
  const totalTime = Date.now() - startTime;
  console.log('\n' + '═'.repeat(60));
  console.log('🎉 [Daily Expander] Run Complete');
  console.log('═'.repeat(60));
  console.log(`   ✅ Inserted    : ${inserted}`);
  console.log(`   ⏭️  Skipped     : ${skipped}`);
  console.log(`   ❌ Failed      : ${failed}`);
  console.log(`   ⏱️  Total time  : ${formatDuration(totalTime)}`);

  if (inserted > 0) {
    console.log('\n   📚 Breakdown by difficulty:');
    (Object.entries(byLevel) as [DifficultyLevel, number][])
      .filter(([, count]) => count > 0)
      .forEach(([level, count]) =>
        console.log(`      ${level.padEnd(14)}: ${count} words`)
      );
  }

  if (failedWords.length > 0) {
    console.log(`\n   ⚠️  Failed words (will retry tomorrow):\n      ${failedWords.join(', ')}`);
  }

  // Remaining unprocessed words
  const remaining = MASTER_WORD_LIST.filter((w) => !existingSet.has(w.toLowerCase())).length - toProcess.length;
  if (remaining > 0) {
    console.log(`\n   🔜 Still in queue: ${remaining} more word(s) across future runs`);
  } else {
    console.log('\n   🏁 All master-list words are now in the dictionary!');
  }
  console.log('═'.repeat(60) + '\n');
}

// ─── CRON SCHEDULE ────────────────────────────────────────────────────────────
// '0 10 * * *' → 10:00 AM UTC = 5:00 AM EST (UTC-5) / 6:00 AM EDT (UTC-4)
// node-cron uses the server's local timezone unless TZ is set.
// For reliability, always run the server with TZ=UTC (see .env or process.env.TZ).

export function startDailyDictionaryExpander(): void {
  // '0 10 * * *' = every day at 10:00 UTC = 5:00 AM EST
  const schedule = process.env.EXPANDER_CRON || '0 10 * * *';

  console.log('⏰ [Daily Expander] Cron job scheduled: 5:00 AM EST (10:00 UTC) daily');

  cron.schedule(schedule, async () => {
    try {
      await runDailyExpansion();
    } catch (error) {
      console.error('❌ [Daily Expander] Cron job crashed:', error);
    }
  }, {
    timezone: 'America/New_York', // EST/EDT handled automatically
  });
}

// ─── MANUAL TRIGGER (for testing / admin API) ─────────────────────────────────
export async function triggerDailyExpansionNow(): Promise<void> {
  await runDailyExpansion();
}
