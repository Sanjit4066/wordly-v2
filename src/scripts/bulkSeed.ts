import dotenv from 'dotenv';
dotenv.config();

import connectMongoDB from '../lib/mongodb';
import Word from '../models/Dictionary';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';

// 250 words per level = 1000 total
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
    'other','our','out','over','own','pain','pass','pay','people','pick',
    'place','plan','play','point','poor','pull','push','put','read','ready',
    'real','reason','red','remember','rest','right','rise','road','rock','run',
    'safe','same','save','say','school','see','seem','sell','send','set',
    'share','show','sign','simple','sing','sit','sleep','small','smile','south',
    'speak','spend','stand','start','stay','stop','store','strong','study','sun',
    'sure','swim','take','talk','teach','tell','thank','think','throw','time',
    'tired','together','too','top','touch','travel','true','try','turn','understand',
    'use','very','wait','walk','want','warm','watch','water','wear','week',
    'well','west','wide','wind','wish','with','wonder','word','work','world',
    'worry','write','wrong','year','yet','young','your','zero','zone','zoom'
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
    'vary','version','virtual','visible','voluntary','vulnerable','widespread','withdraw','witness','achieve'
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
    'undermine','unequivocal','unprecedented','vague','venerate','verbose','versatile','vindicate','volatile','zealous'
  ],
  expert: [
    'abeyance','abnegate','abscond','abstemious','accretion','acerbic','acrimony','adamantine','adumbrate','aegis',
    'afflatus','aggrandizement','agonistic','aleatoric','aleatory','alieniloquy','allopath','amanuensis','ameliorate','analeptic',
    'anamnesis','anfractuous','animadversion','antinomy','apocryphal','apodictic','apogee','apophenia','apotheosis','apriorism',
    'apposite','arabesque','arcane','arrogate','asperity','atavism','atrabilious','autodidact','axiological','bathetic',
    'brachylogy','cachinnate','calumny','casuistry','catachresis','chicanery','chimerical','clerisy','cognoscenti','compunction',
    'concomitant','consanguinity','contumacious','cosmogony','cupidity','defalcation','defenestration','demiurge','denigrate','denouement',
    'deracinate','desideratum','diatribe','didactic','dilettante','discomfit','discursive','disingenuous','dissimulate','dogmatic',
    'ebullient','effrontery','egregious','elegy','elision','emollient','empiricism','encomium','endemic','enervate',
    'ennui','ephebe','episteme','equanimity','equivocate','erudite','eschatology','etiolate','etymology','eudaimonia',
    'eulogize','euphony','excoriate','execrate','exegesis','exiguous','expatiate','expiate','expunge','extirpate',
    'fatuous','felicitous','filibuster','flagitious','fulminate','garrulous','genuflect','grandiloquent','hagiography','harbinger',
    'hermeneutics','heterodox','heuristic','hubris','hypostasis','iconoclast','idiosyncrasy','ignominious','immutable','impecunious',
    'imperious','impugn','inchoate','ineluctable','inexorable','inimical','iniquitous','insouciance','interpolate','interregnum',
    'inveterate','irascible','jejune','juxtapose','lachrymose','lassitude','legerdemain','limerence','loquacious','lugubrious',
    'machiavellian','magnanimous','malapropism','malodorous','melancholia','mendacious','mercurial','metaphysical','meretricious','misanthrope',
    'mnemonic','moribund','munificent','narcissism','neologism','nihilism','numinous','obdurate','obfuscate','obloquy',
    'obstreperous','obsequious','obtuse','occlude','oligarchy','ontology','opprobrium','ostracize','palimpsest','panacea',
    'panegyric','paradigm','pariah','parlance','parsimonious','peccadillo','perfidious','peripatetic','peroration','perspicacious',
    'pertinacious','petulant','phantasmagoria','philistine','plenipotentiary','polemic','positivism','postulate','pragmatism','predilection',
    'probity','proclivity','prolix','propitious','proscribe','pulchritude','punctilious','pusilanimous','quixotic','recalcitrant',
    'recidivism','reification','remonstrate','reprobate','requite','ruminate','sagacious','salutary','sanctimonious','sardonic',
    'saturnine','schadenfreude','scintilla','semiotic','senescence','sesquipedalian','sibilant','sinecure','sobriety','solecism',
    'solipsism','somnolent','sophistry','soporific','stertorous','stigmatize','stolid','stygian','subjugate','sycophant',
    'synecdoche','taciturn','tautology','tendentious','tergiversate','timorous','toady','torpid','tortuous','transmogrify',
    'trenchant','trepidation','truculent','tumultuous','turpitude','ululate','unctuous','undulate','usurp','uxorious',
    'vacuous','venal','venial','verisimilitude','vexillology','vicarious','vitiate','vituperate','voluble','weltanschauung'
  ]
};

async function generateWordData(word: string, level: DifficultyLevel): Promise<any> {
  const prompt = `
Analyze the English word "${word}" and return a JSON object:
{
  "word": "${word}",
  "meaning": "clear definition in 1-2 sentences",
  "sentence": "one natural example sentence",
  "level": "${level}",
  "synonyms": ["2-3 synonyms"],
  "antonyms": ["2-3 antonyms"],
  "etymology": "brief origin in 1 sentence",
  "partOfSpeech": "noun|verb|adjective|adverb|etc"
}
Return ONLY the JSON. No markdown, no backticks.`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim().replace(/```json|```/g, '').trim();
  return JSON.parse(text);
}

async function bulkSeed() {
  await connectMongoDB();
  console.log('\n🌱 Starting bulk seed — 1000 words across 4 difficulty levels...\n');

  const levels: DifficultyLevel[] = ['beginner', 'intermediate', 'advanced', 'expert'];
  let totalInserted = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  for (const level of levels) {
    const words = WORD_LISTS[level];
    console.log(`\n📚 Processing ${words.length} ${level.toUpperCase()} words...`);

    let levelInserted = 0;
    let levelSkipped = 0;
    let levelFailed = 0;

    for (let i = 0; i < words.length; i++) {
      const word = words[i].toLowerCase().trim();

      try {
        // Check if already exists
        const exists = await Word.findOne({ word });
        if (exists) {
          levelSkipped++;
          totalSkipped++;
          process.stdout.write(`⏭️ `);
          continue;
        }

        const data = await generateWordData(word, level);

        await Word.create({
          word: data.word || word,
          meaning: data.meaning || '',
          sentence: data.sentence || '',
          level,
          synonyms: data.synonyms || [],
          antonyms: data.antonyms || [],
          etymology: data.etymology || '',
          partOfSpeech: data.partOfSpeech || 'unknown',
          addedVia: 'manual',
        });

        levelInserted++;
        totalInserted++;
        process.stdout.write(`✅`);

        // Progress update every 25 words
        if ((i + 1) % 25 === 0) {
          console.log(`\n   [${level}] ${i + 1}/${words.length} done — inserted: ${levelInserted}, skipped: ${levelSkipped}, failed: ${levelFailed}`);
        }

        // Small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 300));

      } catch (error: any) {
        levelFailed++;
        totalFailed++;
        process.stdout.write(`❌`);
        // Continue on failure
        await new Promise(r => setTimeout(r, 500));
      }
    }

    console.log(`\n✅ ${level.toUpperCase()} complete — inserted: ${levelInserted}, skipped: ${levelSkipped}, failed: ${levelFailed}`);
  }

  // Final summary
  console.log('\n' + '─'.repeat(50));
  console.log('📊 BULK SEED COMPLETE');
  console.log('─'.repeat(50));
  console.log(`   ✅ Inserted : ${totalInserted}`);
  console.log(`   ⏭️  Skipped  : ${totalSkipped}`);
  console.log(`   ❌ Failed   : ${totalFailed}`);

  // Show final dictionary stats
  const stats = await Word.aggregate([
    { $group: { _id: '$level', count: { $sum: 1 } } },
    { $sort: { _id: 1 } }
  ]);

  console.log('\n📚 Dictionary Stats:');
  let total = 0;
  stats.forEach((s: any) => {
    console.log(`   ${s._id.padEnd(14)}: ${s.count} words`);
    total += s.count;
  });
  console.log(`   ${'TOTAL'.padEnd(14)}: ${total} words`);
  console.log('─'.repeat(50) + '\n');

  process.exit(0);
}

bulkSeed().catch(err => {
  console.error('Bulk seed failed:', err);
  process.exit(1);
});
