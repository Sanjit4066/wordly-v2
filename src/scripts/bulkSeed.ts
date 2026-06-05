import dotenv from 'dotenv';
dotenv.config();

import connectMongoDB from '../lib/mongodb';
import Word from '../models/Dictionary';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';

const DELAY_MS = 4500; // 4.5 seconds between requests = ~13 RPM (safely under 15 RPM limit)

const WORD_LISTS: Record<DifficultyLevel, string[]> = {
  beginner: [
    'able','accept','act','add','afraid','after','again','age','ago','agree',
    'air','all','allow','also','always','angry','animal','answer','any','area',
    'ask','baby','back','bad','bag','ball','bank','base','bath','be',
    'bear','beat','become','begin','believe','belong','best','big','bird','black',
    'block','blood','blow','blue','body','book','born','both','box','boy',
    'break','bring','brother','build','burn','buy','call','care','carry','catch',
    'cause','change','cheap','check','child','city','class','clean','clear','climb',
    'close','cold','come','cook','cool','copy','cost','count','cover','cry',
    'cut','dark','day','dead','deal','deep','deny','describe','die','different',
    'difficult','dirt','do','door','draw','dream','drink','drive','drop','dry',
    'each','early','earn','easy','eat','end','enter','even','every','example',
    'face','fact','fail','fall','family','far','fast','fat','feel','few',
    'fight','find','finish','fire','fish','fix','fly','follow','food','forget',
    'form','found','free','friend','from','front','full','fun','game','get',
    'give','glad','go','good','great','green','grow','guess','hand','hang',
    'hard','hate','have','head','hear','heart','heat','help','high','hold',
    'home','hope','hot','house','hurt','idea','important','include','increase','inside',
    'interest','join','jump','keep','kill','kind','know','large','last','late',
    'laugh','lay','lead','learn','leave','left','let','life','lift','light',
    'like','list','listen','little','live','long','look','lose','lot','love',
    'low','make','man','many','mark','matter','mean','meet','mind','miss',
    'mix','money','month','more','move','much','need','never','next','nice',
    'night','north','note','now','number','offer','often','once','open','order',
    'other','out','over','own','pain','pass','pay','people','pick','place'
  ],
  intermediate: [
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
    'abstract','accelerate','accumulate','accurate','acknowledge','activate','acute','adamant','adhere','adjacent'
  ],
  advanced: [
    'aberrant','abstruse','acrimony','acumen','adumbrate','aesthetic','affectation','aggrandize','alacrity','alienate',
    'allegory','alleviate','altruism','amalgamate','ambivalent','ameliorate','anachronism','anarchy','anecdote','anomaly',
    'antagonist','antipathy','apathy','apprehension','arcane','arduous','articulate','ascertain','assertion','assiduous',
    'atrophy','audacious','austere','authentic','avarice','aversion','axiom','benevolent','bombastic','brevity',
    'bureaucracy','callous','candid','capitulate','catalyst','caustic','charisma','chronological','circumspect','clandestine',
    'coerce','cognizant','cohesive','collaborate','compelling','complacent','comprehensive','concise','condescend','convoluted',
    'copious','corroborate','credible','cryptic','culminate','cynical','debilitate','decipher','deficient','deliberate',
    'delineate','demeaning','deplore','derogatory','despondent','diligent','discrepancy','disdain','disparate','dissent',
    'divergent','eccentric','elaborate','eloquent','emulate','enigmatic','ephemeral','equivocal','eradicate','erroneous',
    'esoteric','euphemism','exacerbate','exorbitant','expedient','explicit','exuberant','fabricate','fallacious','fastidious',
    'fervent','formidable','forthright','frugal','futile','grandiose','gregarious','hamper','haphazard','hegemony',
    'hierarchy','hypocrite','hypothetical','ideological','imminent','impartial','impeccable','implicit','incisive','incongruous',
    'indifferent','indignant','indolent','inevitable','infallible','inherent','insinuate','integrity','intrinsic','intuitive',
    'ironic','laconic','latent','lethargic','lucid','malevolent','meticulous','mitigate','myopic','nonchalant',
    'nostalgic','notorious','nuanced','oblivious','ominous','opaque','optimistic','ostentatious','paradox','partisan',
    'passive','patronize','pedantic','pensive','pervasive','pessimistic','poignant','pragmatic','precarious','pretentious',
    'prodigious','profound','prolific','provocative','prudent','radiant','rationalize','reticent','rhetoric','rigorous',
    'sarcastic','scrutinize','serendipity','shrewd','skeptical','sophisticated','speculation','stoic','subjective','subtle',
    'superficial','surplus','sustainable','sympathetic','tangible','tenacious','theoretical','trivial','turbulent','ubiquitous',
    'undermine','unequivocal','unprecedented','vague','venerate','verbose','versatile','vindicate','volatile','zealous',
    'admonish','adversarial','affinity','aloof','altercation','amicable','anachronistic','apocryphal','arbitrary','ardor',
    'ascetic','assiduous','bellicose','benefactor','blithe','boorish','bravado','bucolic','burgeon','capricious',
    'censure','chagrin','chicanery','clairvoyant','clemency','cognition','combustible','commensurate','compunction','conciliatory',
    'condone','congenial','contentious','contrite','culpable','dauntless','debonair','decorum','deferential','deft'
  ],
  expert: [
    'abeyance','abnegate','abscond','abstemious','accretion','acerbic','adamantine','adumbrate','aegis','afflatus',
    'aggrandizement','agonistic','aleatoric','amanuensis','ameliorate','analeptic','anamnesis','anfractuous','animadversion','antinomy',
    'apocryphal','apodictic','apogee','apophenia','apotheosis','apriorism','apposite','arabesque','arrogate','asperity',
    'atavism','atrabilious','autodidact','axiological','bathetic','brachylogy','cachinnate','calumny','casuistry','catachresis',
    'chicanery','chimerical','clerisy','cognoscenti','compunction','concomitant','consanguinity','contumacious','cosmogony','cupidity',
    'defalcation','defenestration','demiurge','denigrate','denouement','deracinate','desideratum','diatribe','didactic','dilettante',
    'discomfit','discursive','disingenuous','dissimulate','dogmatic','ebullient','effrontery','egregious','elegy','elision',
    'emollient','empiricism','encomium','endemic','enervate','ennui','episteme','equanimity','equivocate','erudite',
    'eschatology','etiolate','etymology','eudaimonia','eulogize','euphony','excoriate','execrate','exegesis','exiguous',
    'expatiate','expiate','expunge','extirpate','fatuous','felicitous','filibuster','flagitious','fulminate','garrulous',
    'genuflect','grandiloquent','hagiography','harbinger','hermeneutics','heterodox','heuristic','hubris','hypostasis','iconoclast',
    'idiosyncrasy','ignominious','immutable','impecunious','imperious','impugn','inchoate','ineluctable','inexorable','inimical',
    'iniquitous','insouciance','interpolate','interregnum','inveterate','irascible','jejune','juxtapose','lachrymose','lassitude',
    'legerdemain','limerence','loquacious','lugubrious','machiavellian','magnanimous','malapropism','melancholia','mendacious','mercurial',
    'metaphysical','meretricious','misanthrope','mnemonic','moribund','munificent','narcissism','neologism','nihilism','numinous',
    'obdurate','obfuscate','obloquy','obstreperous','obsequious','occlude','oligarchy','ontology','opprobrium','ostracize',
    'palimpsest','panacea','panegyric','paradigm','pariah','parlance','parsimonious','peccadillo','perfidious','peripatetic',
    'peroration','perspicacious','pertinacious','petulant','phantasmagoria','philistine','polemic','positivism','postulate','pragmatism',
    'predilection','probity','proclivity','prolix','propitious','proscribe','pulchritude','punctilious','quixotic','recalcitrant',
    'recidivism','reification','remonstrate','reprobate','requite','ruminate','sagacious','salutary','sanctimonious','sardonic',
    'saturnine','schadenfreude','scintilla','semiotic','senescence','sesquipedalian','sibilant','sinecure','solecism','solipsism',
    'somnolent','sophistry','soporific','stigmatize','stolid','subjugate','sycophant','synecdoche','taciturn','tautology',
    'tendentious','tergiversate','timorous','torpid','tortuous','transmogrify','trenchant','trepidation','truculent','turpitude',
    'ululate','unctuous','undulate','usurp','vacuous','venal','venial','verisimilitude','vitiate','vituperate',
    'voluble','weltanschauung','xenophobia','zeitgeist','zealotry','acedia','afflatus','agnosticism','algolagnia','alieniloquy'
  ]
};

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function generateWordData(word: string, level: DifficultyLevel): Promise<any> {
  const prompt = `Analyze the English word "${word}" and return ONLY this JSON object with no markdown:
{
  "word": "${word}",
  "meaning": "clear definition in 1-2 sentences",
  "sentence": "one natural example sentence using the word",
  "level": "${level}",
  "synonyms": ["2-3 synonyms"],
  "antonyms": ["1-2 antonyms"],
  "etymology": "brief origin in 1 sentence",
  "partOfSpeech": "noun or verb or adjective or adverb"
}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim().replace(/```json|```/g, '').trim();
  return JSON.parse(text);
}

async function bulkSeed() {
  await connectMongoDB();

  const levels: DifficultyLevel[] = ['beginner', 'intermediate', 'advanced', 'expert'];
  let totalInserted = 0;
  let totalSkipped = 0;
  let totalFailed = 0;
  const failedWords: string[] = [];

  console.log('\n🌱 Wordly V2 — Bulk Seed (1000 words)');
  console.log('⏱️  Rate limit: 1 word every 4.5s (~13 RPM, safely under Gemini free limit)');
  console.log('⏳ Estimated time: ~75 minutes\n');

  for (const level of levels) {
    const words = WORD_LISTS[level];
    console.log(`\n📚 [${level.toUpperCase()}] Starting ${words.length} words...`);

    let levelInserted = 0;
    let levelSkipped = 0;
    let levelFailed = 0;

    for (let i = 0; i < words.length; i++) {
      const word = words[i].toLowerCase().trim();
      const progress = `[${i + 1}/${words.length}]`;

      try {
        const exists = await Word.findOne({ word });
        if (exists) {
          levelSkipped++;
          totalSkipped++;
          process.stdout.write(`⏭️ `);
          continue;
        }

        const data = await generateWordData(word, level);

        await Word.create({
          word: data.word?.toLowerCase() || word,
          meaning: data.meaning || '',
          sentence: data.sentence || '',
          level,
          synonyms: Array.isArray(data.synonyms) ? data.synonyms : [],
          antonyms: Array.isArray(data.antonyms) ? data.antonyms : [],
          etymology: data.etymology || '',
          partOfSpeech: data.partOfSpeech || 'unknown',
          addedVia: 'manual',
        });

        levelInserted++;
        totalInserted++;
        process.stdout.write(`✅`);

        // Print detailed progress every 10 words
        if ((i + 1) % 10 === 0) {
          const totalDone = totalInserted + totalSkipped + totalFailed;
          const elapsed = Math.round((totalDone * DELAY_MS) / 60000);
          console.log(`\n   ${progress} inserted:${levelInserted} skipped:${levelSkipped} failed:${levelFailed} | ~${elapsed} min elapsed`);
        }

        // Rate limit delay — 4.5 seconds between each word
        await delay(DELAY_MS);

      } catch (error: any) {
        levelFailed++;
        totalFailed++;
        failedWords.push(`${word} (${level})`);
        process.stdout.write(`❌`);
        await delay(DELAY_MS);
      }
    }

    console.log(`\n✅ [${level.toUpperCase()}] Done — inserted: ${levelInserted}, skipped: ${levelSkipped}, failed: ${levelFailed}`);
  }

  // Final summary
  const stats = await Word.aggregate([
    { $group: { _id: '$level', count: { $sum: 1 } } },
    { $sort: { _id: 1 } }
  ]);

  console.log('\n' + '═'.repeat(50));
  console.log('🎉 BULK SEED COMPLETE');
  console.log('═'.repeat(50));
  console.log(`   ✅ Inserted  : ${totalInserted}`);
  console.log(`   ⏭️  Skipped   : ${totalSkipped}`);
  console.log(`   ❌ Failed    : ${totalFailed}`);
  console.log('\n📚 Dictionary by Difficulty:');
  let total = 0;
  stats.forEach((s: any) => {
    console.log(`   ${s._id.padEnd(14)}: ${s.count} words`);
    total += s.count;
  });
  console.log(`   ${'TOTAL'.padEnd(14)}: ${total} words`);

  if (failedWords.length > 0) {
    console.log(`\n⚠️  Failed words (can retry): ${failedWords.join(', ')}`);
  }

  console.log('═'.repeat(50) + '\n');
  process.exit(0);
}

bulkSeed().catch(err => {
  console.error('❌ Bulk seed crashed:', err);
  process.exit(1);
});
