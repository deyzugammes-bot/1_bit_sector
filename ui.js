// 1-Bit Sector V5.4.5 — V5.4.3 + cosmetics back button only
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  let homeMode = 'start';
  let metaStage = 'root';
  let metaCategoryId = 'power';
  let cosmeticStage = 'root';
  let cosmeticSlot = 'style';
  let cosmeticSelection = '';
  let signalStage = 'root';
  let shopStage = 'root';
  const livePreviewTokens = new WeakMap();

  const rarityOrder = ['COMMON','RARE','EPIC','CORRUPTED'];
  const slotNames = {style:'SIGNAL STYLE',capital:'CAPITAL',drone:'DRONE',trail:'TRAIL',capture:'CAPTURE FX'};
  const slotIcons = {style:'01',capital:'▲',drone:'>▲',trail:'→',capture:'◎'};
  const styleColors = {classic:'#ffffff',amber:'#ffb347',phosphor:'#78ffad',void:'#9bbcff',glitch:'#ff62d7'};

  function esc(v){ return String(v ?? '').replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
  function setTitle(title, sub=''){
    if($('shopTitle')) $('shopTitle').textContent = title;
    if($('shopSubtitle')) $('shopSubtitle').textContent = sub;
  }
  function setAction(text, visible=true, disabled=false){
    const b=$('btnAction'); if(!b) return;
    b.style.display=visible?'block':'none'; b.disabled=!!disabled; if(text) b.textContent=text;
  }
  function hidePanels(){
    ['retentionPanel','metaPanel','cosmeticsPanel','protocolPanel','adPanel'].forEach(id=>{const el=$(id);if(el){el.innerHTML='';el.classList.remove('open','choosing');}});
  }
  function renderPanelBack(target='home'){
    const nav=$('menuQuickNav'); if(!nav) return;
    nav.innerHTML='<button class="v5-back-top" id="v5BackHome">‹ BACK</button>';
    $('v5BackHome')?.addEventListener('click',()=> target==='shop' ? openHomePanel('shop') : restoreHome());
  }
  function rarityCounts(){
    const out={COMMON:0,RARE:0,EPIC:0};
    PROTOCOLS.forEach(p=>{const n=protocolCount(p.id);if(n) out[p.rarity||'COMMON']=(out[p.rarity||'COMMON']||0)+n;});
    return out;
  }
  function buildRows(){
    return PROTOCOLS.filter(p=>protocolCount(p.id)>0).sort((a,b)=>{
      const r=rarityOrder.indexOf(a.rarity||'COMMON')-rarityOrder.indexOf(b.rarity||'COMMON');
      return r || a.name.localeCompare(b.name);
    });
  }
  function buildTableMarkup(compact=false){
    const rows=buildRows(), counts=rarityCounts(), stacks=totalProtocolStacks();
    const tier=['','STANDARD','AMPLIFIED','OVERCHARGED','ASCENDANT','SINGULARITY'][runPowerTier()]||'STANDARD';
    if(!rows.length) return `<section class="v5-build-empty"><span>RUN BUILD</span><b>0 STACKS</b><small>Протоколи ще не вибрані</small></section>`;
    const chips=rarityOrder.map(r=>`<span class="v5-rarity-chip ${r.toLowerCase()}">${r} <b>×${counts[r]||0}</b></span>`).join('');
    const body=rows.map(p=>`<div class="v5-build-row"><span class="v5-build-icon">${esc(p.icon)}</span><span class="v5-build-name"><b>${esc(p.name)}</b><small>${esc(p.rarity||'COMMON')}</small></span><strong>×${protocolCount(p.id)}</strong></div>`).join('');
    return `<section class="v5-build ${compact?'compact':''}">
      <div class="v5-section-head"><div><small>RUN BUILD</small><b>${stacks} STACK${stacks===1?'':'S'} // ${rows.length} TYPES</b></div><span>${tier}</span></div>
      <div class="v5-rarity-line">${chips}</div>
      <div class="v5-build-list">${body}</div>
    </section>`;
  }
  function protocolEffectLabel(p){
    const rows=protocolCompareRows(p).slice(0,2);
    return rows.map(r=>`<div class="v5-effect-row"><span>${esc(r.label)}</span><b>${esc(r.before)} <i>→</i> ${esc(r.after)}</b></div>`).join('');
  }

  function protocolLongDetails(p){
    const notes={
      overdrive:['Працює на всіх твоїх флотах у секторі.','Ефект складається до максимального числа stack-ів.'],
      industrial:['Прискорює постійне виробництво на всіх твоїх базах.'],
      storage:['Збільшує максимальний гарнізон кожної твоєї бази.'],
      reinforced:['Зменшує шкоду, яку отримують твої бази від ворожих флотів.'],
      rapid:['Захисні дрони баз стріляють частіше, коли ворог входить у зону оборони.'],
      phase:['Бонус вмикається тільки після проходження порталу.'],
      phasearmor:['Юніти, що пройшли портал, отримують додаткову бойову силу.'],
      surge:['Посилення діє лише перші 25 секунд кожного сектору.'],
      siegebreaker:['Бонус застосовується тільки проти Capital і WARDEN-вузлів.'],
      chainlink:['Після кожного захоплення всі твої вже контрольовані бази отримують підкріплення.'],
      voidwalker:['Одночасно полегшує рух через астероїди і зменшує небезпечну зону чорної діри.'],
      overclock:['Сильний приріст production має ціну: максимальна місткість баз зменшується.'],
      glasscannon:['Сильніше б’єш ворога, але твої бази теж отримують більше шкоди.'],
      emergencygrid:['Вмикається автоматично, коли в тебе лишається 2 або менше вузлів.'],
      signaljam:['Не послаблює армію AI напряму — він просто рідше приймає агресивні рішення.'],
      gatecrash:['Після порталу одночасно посилює швидкість і бойову силу флоту.'],
      momentum:['Бонус до швидкості працює лише на старті сектору.'],
      fortress:['Поєднує більший запас юнітів із сильнішими захисними дронами.']
    };
    const rows=protocolCompareRows(p).slice(0,2).map(r=>`${r.label}: ${r.before} → ${r.after}`);
    const extra=notes[p.id]||[`Працює в кожному наступному секторі до завершення поточного RUN.`];
    return [...rows,...extra,`Stack: ${protocolCount(p.id)}/${p.max}. Після вибору стане ${Math.min(p.max,protocolCount(p.id)+1)}/${p.max}.`];
  }
  function metaLongDetails(n){
    const L=window.GameLanguage?.get?.()||'uk';
    const pick=(uk,ru,en)=>L==='ru'?ru:L==='en'?en:uk;
    const common=pick(
      'Це постійне покращення: після покупки воно працює у всіх наступних забігах і не скидається після смерті.',
      'Это постоянное улучшение: после покупки оно работает во всех следующих забегах и не сбрасывается после смерти.',
      'This is a permanent upgrade: once bought, it works in every future run and is not lost on death.'
    );
    const protocolExplain=pick(
      'Протоколи — це тимчасові покращення поточного забігу. Після очищення сектору ти обираєш 1 із 3; вони діють до завершення цього забігу.',
      'Протоколы — это временные улучшения текущего забега. После зачистки сектора ты выбираешь 1 из 3; они действуют до конца этого забега.',
      'Protocols are temporary upgrades for the current run. After clearing a sector you choose 1 of 3; they remain active until that run ends.'
    );
    const notes={
      startcache:[common,pick('Кожен сектор починається з більшою кількістю юнітів на твоїй стартовій столиці та стартових аванпостах.','Каждый сектор начинается с большим количеством юнитов на твоей стартовой столице и стартовых аванпостах.','Every sector starts with more units on your capital and starting outposts.')],
      cache2:[common,pick('Додаткові стартові юніти додаються поверх START CACHE I.','Дополнительные стартовые юниты складываются с START CACHE I.','The extra starting units stack on top of START CACHE I.')],
      reactor:[common,pick('Підвищує швидкість виробництва юнітів на всіх твоїх базах у кожному секторі.','Увеличивает скорость производства юнитов на всех твоих базах в каждом секторе.','Increases unit production speed on all your bases in every sector.')],
      navcore:[common,pick('Усі твої флоти постійно рухаються швидше між вузлами.','Все твои флоты постоянно двигаются быстрее между узлами.','All your fleets permanently travel faster between nodes.')],
      salvagecore:[common,pick('Коли забіг закінчується, ти отримуєш більше Dark Matter з накопиченого RUN BANK.','Когда забег заканчивается, ты получаешь больше Dark Matter из накопленного RUN BANK.','When a run ends, you receive more Dark Matter from the accumulated RUN BANK.')],
      salvage2:[common,pick('Ще сильніше збільшує кінцеву виплату і складається із SALVAGE CORE I.','Ещё сильнее увеличивает финальную выплату и складывается с SALVAGE CORE I.','Further increases the final payout and stacks with SALVAGE CORE I.')],
      archive1:[protocolExplain,pick('Додає в пул вибору 3 RARE-протоколи: AFTERBURN, NANO FORGE та BULWARK. Після покупки вони можуть зʼявитися серед трьох карток після перемоги в секторі.','Добавляет в пул выбора 3 RARE-протокола: AFTERBURN, NANO FORGE и BULWARK. После покупки они могут появиться среди трёх карточек после победы в секторе.','Adds 3 RARE Protocols to the choice pool: AFTERBURN, NANO FORGE and BULWARK. After purchase they may appear among the three cards after a sector win.')],
      archive2:[protocolExplain,pick('Додає ще 3 RARE-протоколи: PREDATOR, SEED CORE та RIFT MASTER.','Добавляет ещё 3 RARE-протокола: PREDATOR, SEED CORE и RIFT MASTER.','Adds 3 more RARE Protocols: PREDATOR, SEED CORE and RIFT MASTER.')],
      archive3:[protocolExplain,pick('Додає 5 сильніших RARE-протоколів, які помітно змінюють стиль build: PULSE CORE, SIEGE BREAKER, CHAIN LINK, VOID WALKER та DEEP RESERVE.','Добавляет 5 более сильных RARE-протоколов, заметно меняющих стиль build: PULSE CORE, SIEGE BREAKER, CHAIN LINK, VOID WALKER и DEEP RESERVE.','Adds 5 stronger RARE Protocols that noticeably change your build: PULSE CORE, SIEGE BREAKER, CHAIN LINK, VOID WALKER and DEEP RESERVE.')],
      doctrine1:[protocolExplain,pick('Відкриває EPIC-протоколи з дуже сильними ефектами. Частина з них має мінус або умову, тому вони дозволяють збирати ризикові спеціалізовані build-и.','Открывает EPIC-протоколы с очень сильными эффектами. У части есть минус или условие, поэтому они позволяют собирать рискованные специализированные build-ы.','Unlocks EPIC Protocols with very strong effects. Some have a downside or condition, enabling risky specialized builds.')],
      doctrine2:[protocolExplain,pick('Відкриває фінальні EPIC-протоколи RECLAIMER, GATECRASH, MOMENTUM та FORTRESS. Вони можуть зʼявлятися у пізніх секторах і призначені для найсильніших deep-run build-ів.','Открывает финальные EPIC-протоколы RECLAIMER, GATECRASH, MOMENTUM и FORTRESS. Они могут появляться в поздних секторах и предназначены для самых сильных deep-run build-ов.','Unlocks the final EPIC Protocols RECLAIMER, GATECRASH, MOMENTUM and FORTRESS. They can appear in later sectors and are intended for the strongest deep-run builds.')]
    };
    return notes[n.id]||[common];
  }

  // ---------- HOME / NAV ----------
  function renderHomeSummary(mode='start'){
    homeMode=mode;
    const stats=$('runStats');
    if(!stats) return;
    if(mode==='start'){
      stats.innerHTML=`<div class="v5-home-hero">
        <div class="v5-home-brand"><small>TACTICAL NODE ROGUELITE</small><b>1-BIT SECTOR</b><span>40 SECTORS // 5 ACTS</span></div>
        <div class="v5-home-stats"><div><small>CURRENCY</small><b>✦ ${darkMatter}</b></div><div><small>FULL CLEARS</small><b>${completedRuns}</b></div><div><small>LOST RUNS</small><b>${Math.max(0,totalRuns-completedRuns)}</b></div></div><div class="v54-bestline">BEST // S${String(bestSector).padStart(3,'0')} · RUN #${runNumber}</div>
      </div>`;
    }
  }
  renderMenuQuickNav = function(mode='none'){
    const nav=$('menuQuickNav'); if(!nav) return;
    homeMode=mode;
    if(!['start','end'].includes(mode)){nav.innerHTML='';menuPanelOpen='';return;}
    const metaOwnedCount=META_NODES.filter(n=>metaOwned(n.id)).length;
    const sum=window.CosmeticsSystem?.summary?.()||{owned:5,total:21};
    const unlocked=ACHIEVEMENTS.filter(a=>achievementUnlocks[a.id]).length;
    const next=nextMilestone();
    const dop=dailyOperationInfo(), dc=dailyUiCopy();
    const dbest=dailyOperationBestKey===dop.key?dailyOperationBestSector:0;
    nav.innerHTML=`<div class="v51-home-actions">
      <button class="v56-daily-entry v54-home-feature" data-v5-panel="daily"><span class="v56-daily-mark">◆</span><span><b>${dc.title}</b><small>${dbest?`${dc.best} // S${String(dbest).padStart(3,'0')} // ${formatDailyTime(dailyOperationBestTimeMs)}`:`${dc.same} // ${coreLabel(dop.threat)}`}</small></span><i>›</i></button>
      <button class="v51-shop-entry v54-home-feature" data-v5-panel="shop"><span class="v5-nav-icon">▦</span><span><b>SHOP</b><small>UPGRADES + SIGNAL STYLES</small></span><i>›</i></button>
      <button class="v51-log-entry v54-home-feature tasks" data-v5-panel="retention"><span>✓</span><span><b>PROGRESS</b><small>${next?`NEXT S${String(next.sector).padStart(3,'0')} · `:'ALL MILESTONES · '}${unlocked}/${ACHIEVEMENTS.length} ACH</small></span><i>›</i></button>
    </div>`;
    nav.querySelectorAll('[data-v5-panel]').forEach(b=>b.addEventListener('click',()=>openHomePanel(b.dataset.v5Panel)));
  };
  function restoreHome(){
    menuPanelOpen=''; hidePanels();
    if(homeMode==='end' || runEnded) showSavedRunEnd();
    else showRunStart();
  }
  function coreRoman(level){ return ['', 'I','II','III'][Math.max(0,Math.min(3,Number(level)||0))] || ''; }
  function coreLabel(level){ level=Math.max(0,Math.min(3,Number(level)||0)); return level?`CORE ${coreRoman(level)}`:'BASELINE'; }
  function coreShopCopy(level=selectedThreatLevel){
    const L=window.GameLanguage?.get?.()||'uk';
    const rows={
      uk:[
        ['BASELINE','Стандартний RUN без активного ядра. Чистий баланс і базова нагорода.'],
        ['CORE I','Перший перегруз реактора: вороги сильніші, зате більше Dark Matter і трохи кращі шанси RARE.'],
        ['CORE II','Сильніший тиск: більше FFA та аномалій, вища нагорода і кращий пул рідкісних Protocols.'],
        ['CORE III','Максимальний Core: найсильніші вороги, додаткові hazards і доступ до CORRUPTED Protocols.']
      ],
      ru:[
        ['BASELINE','Стандартный RUN без активного ядра. Чистый баланс и базовая награда.'],
        ['CORE I','Первый перегруз реактора: враги сильнее, зато больше Dark Matter и немного выше шанс RARE.'],
        ['CORE II','Сильнее давление: больше FFA и аномалий, выше награда и лучше пул редких Protocols.'],
        ['CORE III','Максимальный Core: самые сильные враги, дополнительные hazards и доступ к CORRUPTED Protocols.']
      ],
      en:[
        ['BASELINE','Standard RUN with no active core. Base balance and base rewards.'],
        ['CORE I','First reactor overcharge: stronger enemies, more Dark Matter and slightly better RARE odds.'],
        ['CORE II','Higher pressure: more FFA and anomalies, higher rewards and better rare Protocol odds.'],
        ['CORE III','Maximum Core: strongest enemies, extra hazards and access to CORRUPTED Protocols.']
      ]
    };
    const row=(rows[L]||rows.uk)[Math.max(0,Math.min(3,level))];
    const copy={
      uk:{chamber:'CORE CHAMBER',sub:'СКЛАДНІСТЬ RUN',unlocked:'ВІДКРИТО',locked:'ЗАКРИТО',active:'АКТИВНО',enemy:'ВОРОГИ',reward:'DARK MATTER',rare:'RARITY BOOST',play:'ПОЧАТИ RUN',all:'УСІ CORE ВІДКРИТО',clear:'40/40 НА',unlocks:'ВІДКРИЄ'},
      ru:{chamber:'CORE CHAMBER',sub:'СЛОЖНОСТЬ RUN',unlocked:'ОТКРЫТО',locked:'ЗАКРЫТО',active:'АКТИВНО',enemy:'ВРАГИ',reward:'DARK MATTER',rare:'RARITY BOOST',play:'НАЧАТЬ RUN',all:'ВСЕ CORE ОТКРЫТЫ',clear:'40/40 НА',unlocks:'ОТКРОЕТ'},
      en:{chamber:'CORE CHAMBER',sub:'RUN DIFFICULTY',unlocked:'UNLOCKED',locked:'LOCKED',active:'ACTIVE',enemy:'ENEMIES',reward:'DARK MATTER',rare:'RARITY BOOST',play:'START RUN',all:'ALL CORES UNLOCKED',clear:'40/40 ON',unlocks:'UNLOCKS'}
    }[L]||null;
    return {name:row[0],desc:row[1],...copy};
  }
  function coreMetrics(level=selectedThreatLevel){
    const cfg=threatConfig(level), pct=v=>`${Math.round((v-1)*100)}%`, plus=v=>`+${Math.round(v*100)}%`;
    return {enemy:level?`+${Math.round((cfg.enemyProd-1)*100)}%`:'BASE',reward:level?pct(cfg.reward):'BASE',rare:level?plus(cfg.rarityBoost||0):'BASE'};
  }
  function coreUnlockHint(){
    const C=coreShopCopy(selectedThreatLevel);
    if(maxThreatUnlocked>=3) return C.all;
    return `${C.clear} ${coreLabel(maxThreatUnlocked)} → ${C.unlocks} ${coreLabel(maxThreatUnlocked+1)}`;
  }
  function dailyUiCopy(){
    const L=window.GameLanguage?.get?.()||'uk';
    const rows={
      uk:{title:'DAILY OPERATION',sub:'Однаковий забіг для всіх на сьогодні',same:'ОДНАКОВИЙ SEED ДЛЯ ВСІХ',fair:'ЧЕСНИЙ РЕЖИМ',fairText:'META-сила вимкнена · однаковий пул Protocols · без revive та reroll-реклами',best:'ТВІЙ РЕКОРД',attempts:'СПРОБИ',reward:'НАГОРОДА СЬОГОДНІ',start:'ПОЧАТИ DAILY',retry:'ЩЕ ОДНА СПРОБА',share:'КИНУТИ ВИКЛИК ДРУГУ',back:'НАЗАД',rival:'ВИКЛИК ДРУГА',you:'ТИ',cleared:'ОЧИЩЕНО',time:'ЧАС',result:'DAILY RESULT',newBest:'НОВИЙ РЕКОРД',rewardGot:'ОТРИМАНО',complete:'40/40 // DAILY COMPLETE',noBest:'ЩЕ НЕ ГРАВ',rivalBeat:'Ти вже побив цей результат.',rivalNeed:'Спробуй пройти далі або швидше.',track:'ШКАЛА НАГОРОД'},
      ru:{title:'DAILY OPERATION',sub:'Одинаковый забег для всех на сегодня',same:'ОДИНАКОВЫЙ SEED ДЛЯ ВСЕХ',fair:'ЧЕСТНЫЙ РЕЖИМ',fairText:'META-сила отключена · одинаковый пул Protocols · без revive и reroll-рекламы',best:'ТВОЙ РЕКОРД',attempts:'ПОПЫТКИ',reward:'НАГРАДА СЕГОДНЯ',start:'НАЧАТЬ DAILY',retry:'ЕЩЁ ОДНА ПОПЫТКА',share:'БРОСИТЬ ВЫЗОВ ДРУГУ',back:'НАЗАД',rival:'ВЫЗОВ ДРУГА',you:'ТЫ',cleared:'ЗАЧИЩЕНО',time:'ВРЕМЯ',result:'DAILY RESULT',newBest:'НОВЫЙ РЕКОРД',rewardGot:'ПОЛУЧЕНО',complete:'40/40 // DAILY COMPLETE',noBest:'ЕЩЁ НЕ ИГРАЛ',rivalBeat:'Ты уже побил этот результат.',rivalNeed:'Попробуй пройти дальше или быстрее.',track:'ШКАЛА НАГРАД'},
      en:{title:'DAILY OPERATION',sub:'The same run for everyone today',same:'SAME SEED FOR EVERYONE',fair:'FAIR MODE',fairText:'META power off · same Protocol pool · no revive or reroll ads',best:'YOUR BEST',attempts:'ATTEMPTS',reward:'REWARD TODAY',start:'START DAILY',retry:'TRY AGAIN',share:'CHALLENGE A FRIEND',back:'BACK',rival:'FRIEND CHALLENGE',you:'YOU',cleared:'CLEARED',time:'TIME',result:'DAILY RESULT',newBest:'NEW BEST',rewardGot:'EARNED',complete:'40/40 // DAILY COMPLETE',noBest:'NOT PLAYED YET',rivalBeat:'You already beat this result.',rivalNeed:'Go farther or finish faster.',track:'REWARD TRACK'}
    };
    return rows[L]||rows.uk;
  }
  function dailyRivalBeaten(){
    const info=dailyOperationInfo(), r=dailyOperationRival;
    if(!r||r.day!==info.key||!dailyOperationBestSector) return false;
    return dailyOperationBestSector>r.sector || (dailyOperationBestSector===r.sector && dailyOperationBestTimeMs>0 && dailyOperationBestTimeMs<r.time);
  }
  function dailyRewardTrack(){
    const marks=[[8,20],[16,40],[24,70],[32,100],[40,150]];
    return `<div class="v56-reward-track">${marks.map(([s,r])=>`<div class="${dailyOperationBestSector>=s?'done':''}"><b>S${String(s).padStart(3,'0')}</b><span>+${r} ✦</span></div>`).join('')}</div>`;
  }
  function renderDailyOperationPanel(){
    const panel=$('metaPanel'); if(!panel) return;
    panel.classList.add('open');
    const C=dailyUiCopy(), info=dailyOperationInfo();
    const hasBest=dailyOperationBestKey===info.key && dailyOperationBestSector>0;
    const rival=dailyOperationRival && dailyOperationRival.day===info.key ? dailyOperationRival : null;
    const rivalStatus=rival ? (dailyRivalBeaten()?C.rivalBeat:C.rivalNeed) : '';
    panel.innerHTML=`<div class="v56-daily-panel">
      <div class="v5-wallet v54-wallet-chip"><b>✦ ${darkMatter}</b></div>
      <div class="v56-daily-hero"><small>${info.key} // ${coreLabel(info.threat)}</small><b>◆ ${C.title}</b><span>${C.same}</span></div>
      <div class="v56-fair"><b>${C.fair}</b><span>${C.fairText}</span></div>
      <div class="v56-daily-stats"><div><small>${C.best}</small><b>${hasBest?`S${String(dailyOperationBestSector).padStart(3,'0')}`:'—'}</b><span>${hasBest?formatDailyTime(dailyOperationBestTimeMs):C.noBest}</span></div><div><small>${C.attempts}</small><b>${dailyOperationAttempts}</b><span>${coreLabel(info.threat)}</span></div><div><small>${C.reward}</small><b>${dailyOperationClaimedReward} ✦</b><span>MAX 150 ✦</span></div></div>
      <div class="v56-track-head"><small>${C.track}</small></div>${dailyRewardTrack()}
      ${rival?`<section class="v56-rival"><small>${C.rival}</small><b>${esc(rival.name||'RIVAL')}</b><div><span>S${String(rival.sector).padStart(3,'0')}</span><span>${formatDailyTime(rival.time)}</span></div><em>${esc(rivalStatus)}</em></section>`:''}
      <button class="v56-daily-start" data-daily-start>▶ ${hasBest?C.retry:C.start}</button>
      ${hasBest?`<button class="v56-daily-share" data-daily-share>↗ ${C.share}</button>`:''}
    </div>`;
    panel.querySelector('[data-daily-start]')?.addEventListener('click',()=>{window.PolishFX?.event('select');startDailyOperation();});
    panel.querySelector('[data-daily-share]')?.addEventListener('click',()=>{window.PolishFX?.event('select');shareDailyChallenge();});
  }
  function renderDailyResultPanel(result={}){
    const panel=$('metaPanel'); if(!panel) return;
    const C=dailyUiCopy(), info=dailyOperationInfo();
    const cleared=Math.max(0,Number(result.cleared ?? dailyOperationLastSector)||0);
    const tm=Math.max(0,Number(result.timeMs ?? dailyOperationLastTimeMs)||0);
    const reward=Math.max(0,Number(result.reward ?? dailyOperationLastReward)||0);
    const better=!!result.better;
    panel.classList.add('open');
    panel.innerHTML=`<div class="v56-daily-result">
      <div class="v56-result-mark">◆</div><small>${result.completed?C.complete:C.result}</small><b>S${String(cleared).padStart(3,'0')}</b><span>${C.time} // ${formatDailyTime(tm)}</span>
      <div class="v56-result-grid"><div><small>${C.best}</small><b>S${String(dailyOperationBestSector).padStart(3,'0')}</b><span>${formatDailyTime(dailyOperationBestTimeMs)}</span></div><div><small>${C.rewardGot}</small><b>+${reward} ✦</b><span>${dailyOperationClaimedReward}/150 ✦</span></div></div>
      ${better?`<div class="v56-new-best">${C.newBest}</div>`:''}
      <button class="v56-daily-start" data-daily-retry>▶ ${C.retry}</button>
      <button class="v56-daily-share" data-daily-share>↗ ${C.share}</button>
      <button class="v5-back-top v56-result-back" data-daily-back>‹ ${C.back}</button>
    </div>`;
    panel.querySelector('[data-daily-retry]')?.addEventListener('click',()=>startDailyOperation());
    panel.querySelector('[data-daily-share]')?.addEventListener('click',()=>shareDailyChallenge());
    panel.querySelector('[data-daily-back]')?.addEventListener('click',()=>openHomePanel('daily'));
  }
  window.__openDailyOperation=()=>openHomePanel('daily');
  window.__showDailyResult=function(result){
    gameState='shop'; levelWon=false; $('shopUI')?.classList.add('open');
    menuPanelOpen='dailyResult'; hidePanels(); if($('runStats')) $('runStats').innerHTML=''; setAction('',false,true);
    renderPanelBack('home'); setTitle(dailyUiCopy().result,result?.day||dailyUtcKey()); renderDailyResultPanel(result||{});
  };

  function hubNavCopy(){
    const L=window.GameLanguage?.get?.()||'uk';
    if(L==='ru') return {label:'НАВИГАЦИЯ',daily:'DAILY OPERATION',dailySub:'Одинаковый seed на сегодня',progress:'ПРОГРЕСС',progressSub:'Milestones + достижения'};
    if(L==='en') return {label:'NAVIGATION',daily:'DAILY OPERATION',dailySub:'Same seed for everyone today',progress:'PROGRESS',progressSub:'Milestones + achievements'};
    return {label:'НАВІГАЦІЯ',daily:'DAILY OPERATION',dailySub:'Однаковий seed для всіх на сьогодні',progress:'ПРОГРЕС',progressSub:'Milestones + досягнення'};
  }

  function renderShopHub(){
    const panel=$('metaPanel'); if(!panel) return;
    panel.classList.add('open');
    const sum=window.CosmeticsSystem?.summary?.()||{owned:5,total:21};
    const power=metaCounts('power'), protocols=metaCounts('archives'), economy=metaCounts('economy');
    const C=coreShopCopy(selectedThreatLevel), M=coreMetrics(selectedThreatLevel);
    const H=hubNavCopy(), dop=dailyOperationInfo(), dc=dailyUiCopy();
    const dailyBest=dailyOperationBestKey===dop.key?dailyOperationBestSector:0;
    const unlockedAch=ACHIEVEMENTS.filter(a=>achievementUnlocks[a.id]).length;
    const nextAch=nextMilestone();
    const sockets=[1,2,3].map(level=>{
      const locked=level>maxThreatUnlocked, active=level===selectedThreatLevel;
      return `<button class="v5922-core-socket ${active?'active':''} ${locked?'locked':''}" data-core-level="${level}" ${locked?'disabled':''}><small>${locked?'LOCK':'CORE'}</small><b>${coreRoman(level)}</b><i>${active?'●':locked?'×':'○'}</i></button>`;
    }).join('<span class="v5922-core-link"></span>');
    panel.innerHTML=`<div class="v53-shop-root">
      <div class="v5-wallet v54-wallet-chip"><b>✦ ${darkMatter}</b></div>
      <section class="v5922-core-chamber">
        <div class="v5922-core-head"><span><small>${C.sub}</small><b>${C.chamber}</b></span><strong>${C.unlocked} ${maxThreatUnlocked}/3</strong></div>
        <div class="v5922-reactor">
          <button class="v5922-baseline ${selectedThreatLevel===0?'active':''}" data-core-level="0"><small>NO CORE</small><b>BASE</b><i>${selectedThreatLevel===0?'●':'○'}</i></button>
          <span class="v5922-core-link main"></span>
          <div class="v5922-core-sockets">${sockets}</div>
        </div>
        <div class="v5922-core-readout"><div><small>${esc(C.name)}</small><b>${esc(C.desc)}</b></div><div class="v5922-core-metrics"><span><small>${C.enemy}</small><b>${M.enemy}</b></span><span><small>${C.reward}</small><b>${M.reward}</b></span><span><small>${C.rare}</small><b>${M.rare}</b></span></div></div>
        <div class="v5922-core-unlock-hint">${esc(coreUnlockHint())}</div>
      </section>
      <section class="v59256-hub-nav">
        <small class="v59256-hub-nav-label">${H.label}</small>
        <div class="v59256-hub-nav-grid">
          <button class="v59256-hub-nav-btn daily" data-hub-nav="daily"><span>◆</span><div><b>${H.daily}</b><small>${dailyBest?`${dc.best} // S${String(dailyBest).padStart(3,'0')}`:`${H.dailySub} // ${coreLabel(dop.threat)}`}</small></div><i>›</i></button>
          <button class="v59256-hub-nav-btn progress" data-hub-nav="retention"><span>✓</span><div><b>${H.progress}</b><small>${nextAch?`S${String(nextAch.sector).padStart(3,'0')} // `:''}${unlockedAch}/${ACHIEVEMENTS.length} ACH</small></div><i>›</i></button>
        </div>
      </section>
      <div class="v53-shop-question"><small>МАГАЗИН</small><b>ЩО ХОЧЕШ ПОКРАЩИТИ?</b><span>Натисни на блок — одразу побачиш доступні варіанти.</span></div>
      <div class="v53-shop-grid">
        <button class="v53-shop-card" data-shop-cat="power">
          <div class="v53-shop-demo power"><span class="node">▲</span><i>→</i><span class="node boosted">▲</span><b>+</b></div>
          <div><small>БОЙОВІ / СТАРТОВІ БОНУСИ</small><b>POWER</b><em>Швидкість, production, стартові юніти</em></div><strong>${power[0]}/${power[1]}</strong>
        </button>
        <button class="v53-shop-card" data-shop-cat="archives">
          <div class="v53-shop-demo protocols"><span>▣</span><span>◇</span><span>★</span><b>+</b></div>
          <div><small>НОВІ ВАРІАНТИ BUILD</small><b>PROTOCOLS</b><em>Відкривай RARE та EPIC Protocols</em></div><strong>${protocols[0]}/${protocols[1]}</strong>
        </button>
        <button class="v53-shop-card" data-shop-cat="economy">
          <div class="v53-shop-demo economy"><span>✦</span><i>→</i><span>✦✦</span></div>
          <div><small>DARK MATTER / НАГОРОДИ</small><b>ECONOMY</b><em>Більше користі з кожного завершеного RUN</em></div><strong>${economy[0]}/${economy[1]}</strong>
        </button>
        <button class="v53-shop-card" data-shop-target="cosmetics">
          <div class="v53-shop-demo styles"><span>▲</span><i>···</i><span>➤</span><i>──</i><span>◎</span></div>
          <div><small>CAPITAL / DRONE / TRAIL / FX</small><b>SIGNAL STYLES</b><em>Подивись вигляд прямо як у секторі</em></div><strong>${sum.owned}/${sum.total}</strong>
        </button>
      </div>
      <button class="v55-shop-play v5922-core-play" data-shop-play>▶ ${C.play} // ${coreLabel(selectedThreatLevel)}</button>
    </div>`;
    panel.querySelectorAll('[data-core-level]').forEach(b=>b.addEventListener('click',()=>{
      const level=Math.max(0,Math.min(maxThreatUnlocked,Number(b.dataset.coreLevel)||0));
      selectedThreatLevel=level;window.GameTelemetry?.track?.('core_select',{selected_core:level});saveProgress();renderShopHub();window.PolishFX?.event('select');
    }));
    panel.querySelector('[data-shop-play]')?.addEventListener('click',()=>{window.PolishFX?.event('select');startNewRun();});
    panel.querySelectorAll('[data-hub-nav]').forEach(b=>b.addEventListener('click',()=>openHomePanel(b.dataset.hubNav)));
    panel.querySelectorAll('[data-shop-cat]').forEach(b=>b.addEventListener('click',()=>{
      metaCategoryId=b.dataset.shopCat; metaTab=metaCategoryId; metaStage='list'; metaPreviewSelection='';
      renderPanelBack('shop'); setTitle('UPGRADES',metaCategoryId.toUpperCase()); renderMetaPanel(true); window.PolishFX?.event('select');
    }));
    panel.querySelectorAll('[data-shop-target]').forEach(b=>b.addEventListener('click',()=>openHomePanel(b.dataset.shopTarget)));
  }
  function openHomePanel(name){
    window.GameTelemetry?.track?.('menu_open',{panel:name});
    menuPanelOpen=name;
    const shop=$('shopUI'); if(shop) shop.dataset.mode='panel'; document.body.dataset.shopMode='panel';
    ['retentionPanel','metaPanel','cosmeticsPanel','protocolPanel'].forEach(id=>{const e=$(id);if(e){e.innerHTML='';e.classList.remove('open');}});
    if($('runStats')) $('runStats').innerHTML='';
    setAction('',false,true);
    if(name==='shop'){
      shopStage='root'; renderPanelBack('home'); setTitle('SHOP','Choose: power or appearance'); renderShopHub();
    }
    if(name==='meta'){
      metaStage='list';metaPreviewSelection='';renderPanelBack('shop');setTitle('UPGRADES',metaCategoryId.toUpperCase());renderMetaPanel(true);
    }
    if(name==='cosmetics'){
      cosmeticStage='root';cosmeticSelection='';renderPanelBack('shop');setTitle('SIGNAL STYLES','Preview your complete in-game loadout');renderCosmeticsV5();
    }
    if(name==='retention'){
      signalStage='root';renderPanelBack('shop');setTitle('PROGRESS','Milestones and achievements');renderRetentionPanel(true);
    }
    if(name==='daily'){
      renderPanelBack('shop');setTitle(dailyUiCopy().title,dailyUiCopy().sub);renderDailyOperationPanel();
    }
    window.PolishFX?.event('select');
  }

  // Public route used by startup/resume: when a run has ended, SHOP is the authoritative landing screen.
  window.__openCurrentShop = function(){
    gameState='shop'; levelWon=false; $('shopUI')?.classList.add('open');
    openHomePanel('shop');
  };

  const _showRunStart = showRunStart;
  showRunStart = function(){
    if (!runStarted && !runSeed) { runSeed = makeRunSeed(); saveProgress(); }
    gameState='shop'; levelWon=false; setShopMode('start');
    $('shopUI')?.classList.add('open');
    setTitle('1-BIT SECTOR','40 SECTORS // 5 ACTS');
    hidePanels(); renderHomeSummary('start'); renderMenuQuickNav('start');
    setAction(runStarted?'ПРОДОВЖИТИ RUN':'ПОЧАТИ RUN',true,false);
    document.querySelectorAll('.legacy-shop').forEach(el=>el.style.display='none');
  };

  // ---------- PROTOCOL FLOW ----------
  protocolBuildMarkup = function(){ return buildTableMarkup(); };
  renderProtocolChoice = function(){
    const panel=$('protocolPanel'); if(!panel) return;
    panel.classList.add('open');
    if(!protocolChoicePending){
      protocolPreviewSelection='';
      panel.classList.remove('choosing');
      panel.innerHTML=awaitingNextSector?`<div class="v5-result-kicker">BUILD UPDATED</div>${buildTableMarkup()}`:'';
      return;
    }
    const choices=protocolChoicesForSector(protocolChoiceLevel||currentLevel);
    panel.classList.add('choosing');
    const selected=choices.find(p=>p.id===protocolPreviewSelection);
    if(!selected){
      const tier=['','STANDARD','AMPLIFIED','OVERCHARGED','ASCENDANT','SINGULARITY'][runPowerTier()]||'STANDARD';
      panel.innerHTML=`<div class="v5-choice-head"><small>SECTOR ${String(currentLevel).padStart(3,'0')} CLEAR</small><b>CHOOSE 1 PROTOCOL</b><span>${tier}</span></div>
        <div class="v5-protocol-cards">${choices.map(p=>`<button data-protocol-preview="${p.id}" class="v5-protocol-card ${String(p.rarity||'COMMON').toLowerCase()}">
          <span class="v5-protocol-icon">${esc(p.icon)}</span><span class="v5-protocol-copy"><small>${esc(p.rarity||'COMMON')} // ${esc(p.cat.toUpperCase())}</small><b>${esc(p.name)}</b><em>${esc((protocolCompareRows(p)[0]||{}).label||p.cat.toUpperCase())}</em></span><i>›</i>
        </button>`).join('')}</div>
        <div class="v5-build-mini"><span>CURRENT BUILD</span><b>${totalProtocolStacks()} STACKS // ${buildRows().length} TYPES</b></div>`;
      panel.querySelectorAll('[data-protocol-preview]').forEach(btn=>btn.addEventListener('click',()=>{protocolPreviewSelection=btn.dataset.protocolPreview;renderProtocolChoice();window.PolishFX?.event('select');}));
      return;
    }
    const longDetails=protocolLongDetails(selected);
    panel.innerHTML=`<button class="v5-inline-back" data-protocol-back>‹ ALL PROTOCOLS</button>
      <section class="v5-protocol-detail ${String(selected.rarity||'COMMON').toLowerCase()}">
        <div class="v5-detail-title"><span>${esc(selected.icon)}</span><div><small>${esc(selected.rarity||'COMMON')} // ${esc(selected.cat.toUpperCase())}</small><h2>${esc(selected.name)}</h2></div><strong>${protocolCount(selected.id)}/${selected.max}</strong></div>
        <p class="v51-short-desc">${esc(selected.desc)}</p>
        <div class="v5-effect-box">${protocolEffectLabel(selected)}</div>
        <div class="v51-more-info"><small>HOW IT WORKS</small>${longDetails.map(x=>`<div><i>·</i><span>${esc(x)}</span></div>`).join('')}</div>
        <button class="v5-primary" data-protocol-confirm="${selected.id}">ВИБРАТИ ${esc(selected.name)}</button>
      </section>`;
    panel.querySelector('[data-protocol-back]')?.addEventListener('click',()=>{protocolPreviewSelection='';renderProtocolChoice();});
    panel.querySelector('[data-protocol-confirm]')?.addEventListener('click',()=>chooseProtocol(selected.id));
  };
  const _chooseProtocol=chooseProtocol;
  chooseProtocol=function(id){
    const p=PROTOCOL_BY_ID[id];
    _chooseProtocol(id);
    if(p){
      setTitle('BUILD UPDATED',`Next // Sector ${String(currentLevel+1).padStart(3,'0')}`);
      if($('runStats')) $('runStats').innerHTML=`<div class="v5-inline-stats"><span>RUN BANK <b>${runMatter} ✦</b></span><span>NEXT <b>S${String(currentLevel+1).padStart(3,'0')}</b></span></div>`;
      renderProtocolChoice();
      setAction('НАСТУПНИЙ СЕКТОР',true,false);
    }
  };
  showPendingProtocolChoice=function(){
    gameState='shop';levelWon=true;setShopMode('protocol');$('shopUI')?.classList.add('open');
    setTitle('SECTOR CLEAR',`Reward +${pendingReward} ✦ // Run bank ${runMatter} ✦`);
    if($('runStats')) $('runStats').innerHTML='';
    if($('menuQuickNav')) $('menuQuickNav').innerHTML='';
    clearMenuPanels(); renderProtocolChoice(); renderMonetizationPanel(); setAction('',false,true);
  };
  showBetweenSectorReady=function(){
    gameState='shop';levelWon=true;setShopMode('ready');$('shopUI')?.classList.add('open');
    setTitle('BUILD UPDATED',`Next // Sector ${String(currentLevel+1).padStart(3,'0')}`);
    if($('runStats')) $('runStats').innerHTML=`<div class="v5-inline-stats"><span>RUN BANK <b>${runMatter} ✦</b></span><span>NEXT <b>S${String(currentLevel+1).padStart(3,'0')}</b></span></div>`;
    clearMenuPanels();renderProtocolChoice();renderMonetizationPanel();setAction('НАСТУПНИЙ СЕКТОР',true,false);
  };

  // ---------- META ----------
  const META_TIER_GROUPS={
    power:[
      {key:'start',name:'START CACHE',ids:['startcache','cache2','cache3'],values:['+0','+2','+4','+7'],label:'START UNITS',icon:'▲'},
      {key:'reactor',name:'REACTOR TUNE',ids:['reactor','reactor2','reactor3'],values:['100%','103%','106%','110%'],label:'PRODUCTION',icon:'++'},
      {key:'nav',name:'NAV CORE',ids:['navcore','navcore2','navcore3'],values:['100%','103%','106%','110%'],label:'FLEET SPEED',icon:'>>'}
    ],
    economy:[
      {key:'salvage',name:'SALVAGE CORE',ids:['salvagecore','salvage2','salvage3'],values:['+0%','+4%','+8%','+12%'],label:'RUN DM BONUS',icon:'✦'}
    ]
  };
  function metaLangPick(uk,ru,en){const L=window.GameLanguage?.get?.()||'uk';return L==='ru'?ru:L==='en'?en:uk;}
  function metaTierLevel(g){return g.ids.reduce((n,id)=>n+(metaOwned(id)?1:0),0);}
  function metaTierNext(g){const lvl=metaTierLevel(g);return lvl<g.ids.length?META_NODES.find(n=>n.id===g.ids[lvl]):null;}
  function metaLevelPips(level,max=3){return `<span class="v592-meta-pips" aria-label="${level}/${max}">${Array.from({length:max},(_,i)=>`<i class="${i<level?'on':''}"></i>`).join('')}</span>`;}
  function metaCounts(category){
    if(category==='power'||category==='economy'){
      const gs=META_TIER_GROUPS[category]||[];return [gs.reduce((n,g)=>n+metaTierLevel(g),0),gs.reduce((n,g)=>n+g.ids.length,0)];
    }
    const arr=META_NODES.filter(n=>metaCategory(n)===category);return [arr.filter(n=>metaOwned(n.id)).length,arr.length];
  }
  function metaCategoryHint(cat){
    if(cat==='power')return metaLangPick('Постійні бонуси для звичайних RUN. 3 рівні кожного апгрейду. У Daily Fair Mode вимкнені.','Постоянные бонусы для обычных RUN. 3 уровня каждого апгрейда. В Daily Fair Mode отключены.','Permanent bonuses for normal RUNs. 3 levels each. Disabled in Daily Fair Mode.');
    if(cat==='economy')return metaLangPick('Постійно покращує виплату Dark Matter наприкінці RUN. У Daily Fair Mode вимкнено.','Постоянно улучшает выплату Dark Matter в конце RUN. В Daily Fair Mode отключено.','Permanently improves Dark Matter payout at the end of a RUN. Disabled in Daily Fair Mode.');
    return metaLangPick('Відкриває нові Protocols у випадковому виборі. Кожен наступний архів/доктрина потребує попередній.','Открывает новые Protocols в случайном выборе. Каждый следующий архив/доктрина требует предыдущий.','Unlocks new Protocols in random choices. Each next Archive/Doctrine requires the previous one.');
  }
  function metaTierDescription(g){
    const map={
      start:metaLangPick('Більше стартових юнітів на початку кожного сектору.','Больше стартовых юнитов в начале каждого сектора.','More starting units at the beginning of every sector.'),
      reactor:metaLangPick('Трохи прискорює постійне виробництво юнітів на твоїх базах.','Немного ускоряет постоянное производство юнитов на твоих базах.','Slightly increases permanent unit production on your bases.'),
      nav:metaLangPick('Трохи прискорює всі твої флоти між вузлами.','Немного ускоряет все твои флоты между узлами.','Slightly increases all fleet travel speed between nodes.'),
      salvage:metaLangPick('Збільшує Dark Matter, яку ти банкуєш після завершення звичайного RUN.','Увеличивает Dark Matter, которую ты сохраняешь после завершения обычного RUN.','Increases Dark Matter banked after a normal RUN ends.')
    };return map[g.key]||'';
  }
  function renderTierMetaCard(g){
    const lvl=metaTierLevel(g), next=metaTierNext(g), max=g.ids.length, selected=metaPreviewSelection===`tier:${g.key}`;
    const can=!!next&&(!next.requires||metaOwned(next.requires))&&darkMatter>=next.cost;
    const now=g.values[lvl], after=lvl<max?g.values[lvl+1]:'MAX';
    const action=!next?metaLangPick('МАКСИМАЛЬНИЙ РІВЕНЬ','МАКСИМАЛЬНЫЙ УРОВЕНЬ','MAX LEVEL'):can?`${metaLangPick('КУПИТИ РІВЕНЬ','КУПИТЬ УРОВЕНЬ','BUY LEVEL')} ${lvl+1} // ${next.cost} ✦`:`${metaLangPick('НЕ ВИСТАЧАЄ','НЕ ХВАТАЕТ','NEED')} ${Math.max(0,next.cost-darkMatter)} ✦`;
    return `<div class="v53-upgrade-card v592-tier-card ${!next?'done':''} ${selected?'selected':''}" data-meta-kind="${metaCategoryId}">
      <button class="v53-upgrade-main" data-meta-tier="${g.key}">
        <div class="v53-upgrade-head"><span><small>${metaCategoryId.toUpperCase()} // LVL ${lvl}/${max}</small><b>${esc(g.name)}</b></span><strong>${next?`${next.cost} ✦`:'MAX'}</strong></div>
        <div class="v592-meta-level-line"><span class="v592-meta-icon">${esc(g.icon)}</span>${metaLevelPips(lvl,max)}</div>
        <div class="v53-upgrade-visual"><span class="before"><small>${esc(g.label)}</small><b>${esc(now)}</b></span><i>→</i><span class="after"><small>${next?metaLangPick('НАСТУПНИЙ','СЛЕДУЮЩИЙ','NEXT'):'MAX'}</small><b>${esc(after)}</b></span></div>
        <span class="v54-details-pill">${selected?'⌃':'⌄'} ${metaLangPick('ДЕТАЛЬНО','ПОДРОБНО','DETAILS')}</span>
      </button>
      ${selected?`<div class="v53-upgrade-expanded"><p>${esc(metaTierDescription(g))}</p><button class="v5-primary" data-meta-buy="${next?.id||''}" ${!can?'disabled':''}>${esc(action)}</button></div>`:''}
    </div>`;
  }
  function renderProtocolMetaCard(n){
    const owned=metaOwned(n.id),blocked=n.requires&&!metaOwned(n.requires),selected=metaPreviewSelection===n.id,[label,before,after]=metaPreviewText(n),can=!owned&&!blocked&&darkMatter>=n.cost;
    const action=owned?'OWNED':blocked?`REQUIRES ${META_NODES.find(x=>x.id===n.requires)?.name||'PREVIOUS'}`:can?`BUY // ${n.cost} ✦`:`NEED ${Math.max(0,n.cost-darkMatter)} ✦`;
    const details=metaLongDetails(n);
    return `<div class="v53-upgrade-card ${owned?'done':''} ${blocked?'locked':''} ${selected?'selected':''}">
      <button class="v53-upgrade-main" data-meta-item="${n.id}">
        <div class="v53-upgrade-head"><span><small>${esc(n.tag)}</small><b>${esc(n.name)}</b></span><strong>${owned?'✓':blocked?'LOCK':`${n.cost} ✦`}</strong></div>
        <div class="v53-upgrade-visual"><span class="before"><small>${esc(label)}</small><b>${esc(before)}</b></span><i>→</i><span class="after"><small>${metaLangPick('ПІСЛЯ','ПОСЛЕ','AFTER')}</small><b>${esc(after)}</b></span></div>
        <span class="v54-details-pill">${selected?'⌃':'⌄'} ${metaLangPick('ДЕТАЛЬНО','ПОДРОБНО','DETAILS')}</span>
      </button>
      ${selected?`<div class="v53-upgrade-expanded"><p>${esc(n.desc)}</p><div class="v51-more-info"><small>DETAILS</small>${details.map(x=>`<div><i>·</i><span>${esc(x)}</span></div>`).join('')}</div><button class="v5-primary" data-meta-buy="${n.id}" ${!can?'disabled':''}>${esc(action)}</button></div>`:''}
    </div>`;
  }
  renderMetaPanel=function(showShop=false){
    const panel=$('metaPanel'); if(!panel) return;
    if(!showShop || protocolChoicePending){panel.innerHTML='';panel.classList.remove('open');return;}
    panel.classList.add('open');
    const cats=[['power','POWER','▲'],['archives','PROTOCOLS','▣'],['economy','ECONOMY','✦']];
    let cards='';
    if(metaCategoryId==='power'||metaCategoryId==='economy') cards=(META_TIER_GROUPS[metaCategoryId]||[]).map(renderTierMetaCard).join('');
    else cards=META_NODES.filter(n=>metaCategory(n)==='archives').map(renderProtocolMetaCard).join('');
    panel.innerHTML=`<button class="v5-inline-back" data-meta-shop>‹ SHOP</button>
      <div class="v5-wallet v54-wallet-chip"><b>✦ ${darkMatter}</b></div>
      <div class="v53-meta-tabs">${cats.map(([id,name,icon])=>`<button data-meta-tab="${id}" class="${metaCategoryId===id?'active':''}"><span>${icon}</span><b>${name}</b></button>`).join('')}</div>
      <div class="v53-meta-hint v592-meta-hint ${metaCategoryId}">${esc(metaCategoryHint(metaCategoryId))}</div>
      <div class="v53-upgrade-list">${cards||'<div class="v5-build-empty">NO UPGRADES</div>'}</div>`;
    panel.querySelector('[data-meta-shop]')?.addEventListener('click',()=>openHomePanel('shop'));
    panel.querySelectorAll('[data-meta-tab]').forEach(b=>b.addEventListener('click',()=>{metaCategoryId=b.dataset.metaTab;metaTab=metaCategoryId;metaPreviewSelection='';renderMetaPanel(true);window.PolishFX?.event('select');}));
    panel.querySelectorAll('[data-meta-tier]').forEach(b=>b.addEventListener('click',()=>{const key=`tier:${b.dataset.metaTier}`;metaPreviewSelection=metaPreviewSelection===key?'':key;renderMetaPanel(true);window.PolishFX?.event('select');}));
    panel.querySelectorAll('[data-meta-item]').forEach(b=>b.addEventListener('click',()=>{metaPreviewSelection=metaPreviewSelection===b.dataset.metaItem?'':b.dataset.metaItem;renderMetaPanel(true);window.PolishFX?.event('select');}));
    panel.querySelectorAll('[data-meta-buy]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();if(!b.dataset.metaBuy)return;buyMetaUnlock(b.dataset.metaBuy);renderMetaPanel(true);}));
  };

  // ---------- COSMETICS ----------
  function cosAPI(){return window.CosmeticsSystem;}
  function cosOwned(i){return !!cosAPI()?.owned?.(i);}
  function cosGate(i){return cosAPI()?.gateProgress?.(i.gate)||{ok:true,now:0};}
  function cosmeticGateCopy(){
    if(lang==='ru')return {reach:'Достигни сектора',now:'сейчас',wardens:'Победи WARDEN',nodes:'Захвати узлы',anomalies:'Зачисти аномалии',runs:'Заверши RUN',locked:'ЗАКРЫТО'};
    if(lang==='en')return {reach:'Reach sector',now:'now',wardens:'Defeat WARDENS',nodes:'Capture nodes',anomalies:'Clear anomalies',runs:'Finish RUNS',locked:'LOCKED'};
    return {reach:'Досягни сектора',now:'зараз',wardens:'Переможи WARDEN',nodes:'Захопи вузли',anomalies:'Зачисти аномалії',runs:'Заверши RUN',locked:'ЗАКРИТО'};
  }
  function cosmeticGateShort(item){
    if(!item?.gate)return '';
    const g=cosGate(item),t=item.gate.type,v=item.gate.value;
    if(t==='best')return `S${String(Math.min(g.now,v)).padStart(3,'0')} / S${String(v).padStart(3,'0')}`;
    if(t==='boss')return `WARDEN ${Math.min(g.now,v)}/${v}`;
    if(t==='captures')return `NODES ${Math.min(g.now,v)}/${v}`;
    if(t==='events')return `ANOM ${Math.min(g.now,v)}/${v}`;
    if(t==='runs')return `RUN ${Math.min(g.now,v)}/${v}`;
    return `${Math.min(g.now,v)}/${v}`;
  }
  function cosmeticGateLong(item){
    if(!item?.gate)return '';
    const C=cosmeticGateCopy(),g=cosGate(item),t=item.gate.type,v=item.gate.value;
    if(t==='best')return `${C.reach} S${String(v).padStart(3,'0')} // ${C.now} S${String(g.now).padStart(3,'0')}`;
    if(t==='boss')return `${C.wardens}: ${g.now}/${v}`;
    if(t==='captures')return `${C.nodes}: ${g.now}/${v}`;
    if(t==='events')return `${C.anomalies}: ${g.now}/${v}`;
    if(t==='runs')return `${C.runs}: ${g.now}/${v}`;
    return `${C.locked} // ${g.now}/${v}`;
  }
  function cosmeticLoadoutFor(item){
    const api=cosAPI(), state=api?.getState?.()||{equipped:{}};
    const load={style:state.equipped?.style||'classic',capital:state.equipped?.capital||'signal',drone:state.equipped?.drone||'vector',trail:state.equipped?.trail||'signal',capture:state.equipped?.capture||'ring'};
    if(item) load[item.slot]=item.id;
    return load;
  }
  function drawPreviewCapital(c,x,y,skin,color,droneSkin='vector'){
    const shared=window.GameCosmeticPreview?.drawCapital;
    if(shared){shared(c,skin,droneSkin,color,x,y,{radius:20,baseAngle:0,turretAngle:-Math.PI/2});return;}
    c.save();c.translate(x,y);c.strokeStyle=color;c.fillStyle=color;c.beginPath();c.moveTo(0,-20);c.lineTo(18,16);c.lineTo(-18,16);c.closePath();c.fill();c.restore();
  }
  function drawPreviewDrone(c,x,y,skin,color,angle=0){
    const shared=window.GameCosmeticPreview?.drawDrone;
    if(shared){shared(c,skin,color,x,y,angle,5.2);return;}
    c.save();c.translate(x,y);c.rotate(angle);c.strokeStyle=color;c.fillStyle=color;c.beginPath();c.moveTo(8,0);c.lineTo(-5,5);c.lineTo(-2,0);c.lineTo(-5,-5);c.closePath();c.fill();c.restore();
  }
  function drawPreviewTrail(c,x,y,skin,color,now=performance.now(),angle=0){
    const shared=window.GameCosmeticPreview?.drawTrail;
    if(shared){shared(c,skin,color,x,y,angle,now,1);return;}
    c.save();c.translate(x,y);c.strokeStyle=color;c.fillStyle=color;c.globalAlpha=.5;c.lineWidth=1;
    c.beginPath();c.moveTo(-7,-2);c.lineTo(-16,-2);c.moveTo(-7,2);c.lineTo(-13,2);c.stroke();c.restore();
  }
  function drawPreviewCapture(c,x,y,style,color,t){
    const p=Math.max(0,Math.min(1,(t-.76)/.24));if(p<=0)return;
    const shared=window.GameCosmeticPreview?.drawCapture;
    if(shared){const age=p*35,life=Math.max(.02,1-age*.028);shared(c,style,color,x,y,age,life);return;}
    c.save();c.translate(x,y);c.strokeStyle=color;c.globalAlpha=(1-p)*.9;c.lineWidth=2;const r=6+p*30;c.beginPath();c.arc(0,0,r,0,Math.PI*2);c.stroke();c.restore();
  }
  function mountLoadoutPreview(canvas,item){
    if(!canvas)return;const token={};livePreviewTokens.set(canvas,token);const load=cosmeticLoadoutFor(item);const color=styleColors[load.style]||'#fff';
    let lastFrame=0;function frame(now){if(!canvas.isConnected||livePreviewTokens.get(canvas)!==token||canvas.offsetParent===null)return;if(now-lastFrame<33){requestAnimationFrame(frame);return;}lastFrame=now;const dpr=Math.min(devicePixelRatio||1,1.5),w=Math.max(280,canvas.clientWidth||320),h=Math.max(170,canvas.clientHeight||182);if(canvas.width!==Math.floor(w*dpr)||canvas.height!==Math.floor(h*dpr)){canvas.width=Math.floor(w*dpr);canvas.height=Math.floor(h*dpr);}const c=canvas.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);c.fillStyle='#030405';c.fillRect(0,0,w,h);
      c.strokeStyle=color+'18';c.lineWidth=1;for(let x=0;x<w;x+=28){c.beginPath();c.moveTo(x,0);c.lineTo(x,h);c.stroke();}for(let y=0;y<h;y+=28){c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke();}
      c.fillStyle=color;c.font='9px monospace';c.globalAlpha=.55;c.fillText(window.V52Label?.('livePreview')||'LIVE LOADOUT PREVIEW',10,15);c.globalAlpha=1;
      const sx=68,sy=h*.57,tx=w-58,ty=h*.57;drawPreviewCapital(c,sx,sy,load.capital,color,load.drone);
      c.strokeStyle=color+'77';c.beginPath();c.arc(tx,ty,21,0,Math.PI*2);c.stroke();c.setLineDash([3,4]);c.beginPath();c.arc(tx,ty,28,0,Math.PI*2);c.stroke();c.setLineDash([]);c.fillStyle=color;c.globalAlpha=.55;c.fillText(window.V52Label?.('target')||'TARGET',tx-18,ty+42);c.globalAlpha=1;
      const cyc=(now%3600)/3600;const travel=Math.min(1,cyc/.78);const ease=travel<1?travel*travel*(3-2*travel):1;const dx=sx+34+(tx-sx-55)*ease,dy=sy+Math.sin(travel*Math.PI*2)*5;drawPreviewTrail(c,dx,dy,load.trail,color,now,0);drawPreviewDrone(c,dx,dy,load.drone,color,0);drawPreviewCapture(c,tx,ty,load.capture,color,cyc);
      c.fillStyle=color;c.globalAlpha=.7;c.font='8px monospace';c.fillText(`${window.V52Label?.('capital')||'CAPITAL'} ${load.capital.toUpperCase()}`,10,h-22);c.fillText(`${window.V52Label?.('drone')||'DRONE'} ${load.drone.toUpperCase()} // ${window.V52Label?.('trail')||'TRAIL'} ${load.trail.toUpperCase()} // ${window.V52Label?.('fx')||'FX'} ${load.capture.toUpperCase()}`,10,h-9);c.globalAlpha=1;requestAnimationFrame(frame);
    }requestAnimationFrame(frame);
  }
  function renderCosmeticsV5(){
    const panel=$('cosmeticsPanel'); if(!panel) return; panel.classList.add('open');
    const api=cosAPI(); if(!api){panel.innerHTML='';return;}
    const items=api.ITEMS||[], state=api.getState?.()||{equipped:{}};
    if(cosmeticStage==='root'){
      const slots=['style','capital','drone','trail','capture'];
      panel.innerHTML=`<button class="v545-cos-back" data-cos-shop>‹ SHOP</button><div class="v5-wallet v54-wallet-chip"><b>✦ ${darkMatter}</b></div><div class="v51-store-hint">1. ОБЕРИ ЩО МІНЯЄМО · 2. ОБЕРИ ВАРІАНТ · 3. ПЕРЕВІР У LIVE PREVIEW</div><div class="v5-category-grid cosmetics">${slots.map(slot=>{const arr=items.filter(i=>i.slot===slot),own=arr.filter(cosOwned).length;return `<button data-cos-slot="${slot}"><span>${slotIcons[slot]}</span><div><b>${slotNames[slot]}</b><small>${esc(state.equipped?.[slot]||'default').toUpperCase()}</small></div><strong>${own}/${arr.length}</strong></button>`;}).join('')}</div>`;
      panel.querySelector('[data-cos-shop]')?.addEventListener('click',()=>openHomePanel('shop'));
      panel.querySelectorAll('[data-cos-slot]').forEach(b=>b.addEventListener('click',()=>{cosmeticSlot=b.dataset.cosSlot;cosmeticStage='list';cosmeticSelection='';renderCosmeticsV5();})); return;
    }
    const visible=items.filter(i=>i.slot===cosmeticSlot);
    if(cosmeticStage==='list'){
      panel.innerHTML=`<button class="v5-inline-back" data-cos-root>‹ CATEGORIES</button><div class="v5-list-title"><small>STEP 2 // CHOOSE ONE</small><b>${slotNames[cosmeticSlot]}</b></div><div class="v5-cos-grid-list">${visible.map(i=>{const eq=api.getEquipped(cosmeticSlot)===i.id,g=cosGate(i),owned=cosOwned(i);let st=eq?'EQUIPPED':owned?'OWNED':!g.ok?cosmeticGateShort(i):i.cost?`${i.cost} ✦`:'FREE';return `<button data-cos-item="${i.id}" class="${eq?'equipped':''} ${!owned&&!g.ok?'locked':''}"><span>${esc(i.preview)}</span><b>${esc(i.name)}</b><small>${st}</small></button>`;}).join('')}</div>`;
      panel.querySelector('[data-cos-root]')?.addEventListener('click',()=>{cosmeticStage='root';renderCosmeticsV5();});
      panel.querySelectorAll('[data-cos-item]').forEach(b=>b.addEventListener('click',()=>{cosmeticSelection=b.dataset.cosItem;cosmeticStage='detail';renderCosmeticsV5();})); return;
    }
    const item=visible.find(i=>i.id===cosmeticSelection)||visible[0]; if(!item){cosmeticStage='list';renderCosmeticsV5();return;}
    const current=visible.find(i=>i.id===api.getEquipped(cosmeticSlot))||visible[0], owned=cosOwned(item),eq=current?.id===item.id,g=cosGate(item),cost=item.cost||0;
    let action='',disabled=false;if(eq){action='EQUIPPED';disabled=true;}else if(owned)action='EQUIP';else if(!g.ok){action=`LOCKED // ${g.now}/${item.gate.value}`;disabled=true;}else if(cost>darkMatter){action=`NEED ${cost-darkMatter} ✦`;disabled=true;}else action=cost?`UNLOCK // ${cost} ✦`:'UNLOCK';
    panel.innerHTML=`<button class="v5-inline-back" data-cos-list>‹ ${slotNames[cosmeticSlot]}</button><section class="v5-cos-detail">
      <div class="v5-detail-title"><span>${esc(item.preview)}</span><div><small>${slotNames[cosmeticSlot]}</small><h2>${esc(item.name)}</h2></div><strong>${eq?'✓':owned?'OWNED':cost?`${cost} ✦`:'GOAL'}</strong></div>
      <p class="v51-short-desc">${esc(item.desc)}</p>
      <div class="v51-loadout-wrap"><canvas class="v51-loadout-preview" data-v51-loadout></canvas><small>Показано разом з усіма твоїми зараз екіпірованими стилями. Вибраний предмет тимчасово підміняє тільки свій слот.</small></div>
      ${!owned&&item.gate?`<div class="v5-unlock-rule v59251-unlock"><b>${esc(cosmeticGateLong(item))}</b><small>${esc(cosmeticGateShort(item))}</small></div>`:''}
      <button class="v5-primary" data-cos-choose ${disabled?'disabled':''}>${esc(action)}</button></section>`;
    mountLoadoutPreview(panel.querySelector('[data-v51-loadout]'),item);
    panel.querySelector('[data-cos-list]')?.addEventListener('click',()=>{cosmeticStage='list';renderCosmeticsV5();});
    panel.querySelector('[data-cos-choose]')?.addEventListener('click',()=>{api.choose?.(item);cosmeticStage='list';cosmeticSelection='';renderPanelBack('shop');renderCosmeticsV5();});
  }
  if(window.CosmeticsSystem){ window.CosmeticsSystem.render = function(open=true){ if(!open){const p=$('cosmeticsPanel');if(p){p.innerHTML='';p.classList.remove('open');}return;} renderCosmeticsV5(); }; }

  // ---------- PROGRESS LOG ----------
  renderRetentionPanel=function(expanded=false){
    const panel=$('retentionPanel'); if(!panel) return;
    if(!expanded){panel.innerHTML='';panel.classList.remove('open');return;}
    panel.classList.add('open'); const next=nextMilestone(), unlocked=ACHIEVEMENTS.filter(a=>achievementUnlocks[a.id]).length;
    if(signalStage==='root'){
      panel.innerHTML=`<div class="v5-signal-cards">
        <button data-signal="milestones"><span>▦</span><div><small>NEXT MILESTONE</small><b>${next?`SECTOR ${String(next.sector).padStart(3,'0')}`:'ALL CLEARED'}</b><em>${next?`+${next.reward} ✦`:'COMPLETE'}</em></div><i>›</i></button>
        <button data-signal="achievements"><span>★</span><div><small>ACHIEVEMENTS</small><b>${unlocked}/${ACHIEVEMENTS.length} UNLOCKED</b><em>LONG-TERM GOALS</em></div><i>›</i></button>
      </div>`;
      panel.querySelectorAll('[data-signal]').forEach(b=>b.addEventListener('click',()=>{signalStage=b.dataset.signal;renderRetentionPanel(true);})); return;
    }
    let content='';
    if(signalStage==='milestones') content=`<div class="v5-clean-list">${RETENTION_MILESTONES.map(m=>`<div class="v5-static-row ${milestoneClaims[m.id]?'done':''}"><span><b>S${String(m.sector).padStart(3,'0')}</b><small>MILESTONE</small></span><strong>${milestoneClaims[m.id]?'✓':`+${m.reward} ✦`}</strong></div>`).join('')}</div>`;
    if(signalStage==='achievements') content=`<div class="v5-clean-list">${ACHIEVEMENTS.map(a=>`<div class="v5-static-row ${achievementUnlocks[a.id]?'done':''}"><span><b>${esc(a.name)}</b><small>${esc(a.desc)}</small></span><strong>${achievementUnlocks[a.id]?'✓':`+${a.reward} ✦`}</strong></div>`).join('')}</div>`;
    panel.innerHTML=`<button class="v5-inline-back" data-signal-root>‹ PROGRESS</button>${content}`; panel.querySelector('[data-signal-root]')?.addEventListener('click',()=>{signalStage='root';renderRetentionPanel(true);});
  };

  function endSummaryMarkup(completed=false){
    const reached=completed?RUN_LENGTH:currentLevel;
    return `<div class="v5-end-card ${completed?'complete':''}">
      <small>${completed?'FULL CLEAR':'RUN RESULT'}</small><b>${completed?'40 / 40':`S${String(reached).padStart(3,'0')}`}</b><span>${completed?'ALL 5 ACTS CLEARED':`CAPTURED ${runCaptured}`}</span>
      <div class="v5-end-payout"><small>DARK MATTER</small><strong>+${lastRunPayout||0} ✦</strong></div>
      ${completed&&lastThreatUnlock?`<div class="v5922-core-unlock-banner"><small>CORE CHAMBER</small><b>${coreLabel(lastThreatUnlock)} UNLOCKED</b><span>40/40 CLEAR // NEW DIFFICULTY ONLINE</span></div>`:''}
    </div>`;
  }

  // ---------- SHOP STATE NORMALIZATION ----------
  const _openShop=openShop;
  openShop=function(isWin){
    _openShop(isWin);
    if(isWin && currentLevel<RUN_LENGTH){
      setTitle('SECTOR CLEAR',`Reward +${pendingReward} ✦ // Run bank ${runMatter} ✦`);
      if($('runStats')) $('runStats').innerHTML='';
    } else if(!isWin){
      setTitle('RUN LOST',`Sector ${String(currentLevel).padStart(3,'0')} // Run #${runNumber}`);
      if($('runStats')) $('runStats').innerHTML=`<div class="v5-death-summary"><div><small>REACHED</small><b>S${String(currentLevel).padStart(3,'0')}</b></div><div><small>BANK</small><b>${projectedRunPayout()} ✦</b></div><div><small>BUILD</small><b>${totalProtocolStacks()}</b></div></div>`;
    } else {
      setTitle('RUN COMPLETE','40 / 40 // ALL 5 ACTS CLEARED');
      if($('runStats')) $('runStats').innerHTML=endSummaryMarkup(true);
      renderMenuQuickNav('end');
    }
  };
  const _finalizeFailedRun=finalizeFailedRun;
  finalizeFailedRun=function(){
    _finalizeFailedRun();
    if(runEnded){
      setTitle('RUN ENDED',`Run #${runNumber}`);
      if($('runStats')) $('runStats').innerHTML=endSummaryMarkup(false);
      renderMenuQuickNav('end');
      setAction('НОВИЙ RUN',true,false);
    }
  };
  const _showSavedRunEnd=showSavedRunEnd;
  showSavedRunEnd=function(){
    _showSavedRunEnd();
    const completed=runSectorsCleared>=RUN_LENGTH;
    setTitle(completed?'RUN COMPLETE':'RUN ENDED',`Run #${runNumber}`);
    if($('runStats')) $('runStats').innerHTML=endSummaryMarkup(completed);
    renderMenuQuickNav('end');
  };

  // Ads should stay optional and visually secondary.
  const _renderMonetizationPanel=renderMonetizationPanel;
  renderMonetizationPanel=function(){_renderMonetizationPanel();const p=$('adPanel');if(p&&p.innerHTML)p.classList.add('v5-secondary');};

  // Repaint current state after legacy scripts completed.
  function boot(){
    window.__ONEBIT_UI_BUILD='5.9';
    document.documentElement.dataset.uiBuild='5.9';
    document.body.classList.add('ui-v5');
    document.querySelectorAll('.legacy-shop').forEach(el=>el.style.display='none');
    if(gameState==='shop'){
      if(runAwaitingDecision) openShop(false);
      else if(protocolChoicePending) showPendingProtocolChoice();
      else if(awaitingNextSector) showBetweenSectorReady();
      else if(postRunShopPending || (!runStarted && (totalRuns>0 || runNumber>1))){
        postRunShopPending=true;
        // The payout is already banked. Prepare the next run once, but KEEP the persisted
        // post-run route until the player actually starts that next run.
        if(runEnded && !runStarted){
          prepareFreshRun();
          runEnded=false;
          postRunShopPending=true;
        }
        saveProgress();
        window.__openCurrentShop?.();
      }
      else showRunStart();
    }
  }
  // Embedded Telegram/PlayDeck WebViews may restore a page from bfcache instead of
  // executing a clean reload. Always repaint the current state with the newest UI.
  window.__repaintCurrentUI = boot;
  window.addEventListener('pageshow',()=>setTimeout(boot,0));
  document.addEventListener('visibilitychange',()=>{ if(!document.hidden) setTimeout(boot,20); });
  setTimeout(boot,0);
  setTimeout(boot,140);
})();


// 1-Bit Sector V5.3 — UX polish + 3-language localization
(() => {
'use strict';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]||c));

// -------------------------------------------------------------------------
// LOCALIZATION: UK / RU / EN. One runtime layer, one game build.
// -------------------------------------------------------------------------
const LANGS=['uk','ru','en'];
function localeToGameLang(raw){
  const v=String(raw||'').trim().toLowerCase().replace('_','-');
  if(v.startsWith('uk')) return 'uk';
  if(v.startsWith('ru')) return 'ru';
  return 'en';
}
function savedManualLang(){
  try{const saved=localStorage.getItem('1bitLang');return LANGS.includes(saved)?saved:null;}catch(e){return null;}
}
function detectLang(){
  // Any legacy 1bitLang value is treated as a real player choice so updates never overwrite it.
  const manual=savedManualLang(); if(manual) return manual;
  try{const cached=localStorage.getItem('1bitAutoLang');if(LANGS.includes(cached)) return cached;}catch(e){}
  let telegramLocale='';
  try{telegramLocale=window.Telegram?.WebApp?.initDataUnsafe?.user?.language_code||window.Telegram?.WebApp?.initDataUnsafe?.user?.languageCode||'';}catch(e){}
  const raw=document.documentElement.dataset.playdeckLocale||telegramLocale||navigator.language||(navigator.languages&&navigator.languages[0])||'en';
  const picked=localeToGameLang(raw);
  try{localStorage.setItem('1bitAutoLang',picked);}catch(e){}
  return picked;
}
let lang=detectLang();
const UI={
 uk:{
  back:'НАЗАД',choose:'ОБЕРИ 1 ПРОТОКОЛ',select:'ВИБРАТИ',details:'ДЕТАЛЬНО',currentBuild:'ПОТОЧНИЙ BUILD',
  stacks:'СТЕКІВ',types:'ТИПІВ',shop:'МАГАЗИН',upgrades:'ПОКРАЩЕННЯ',styles:'ОФОРМЛЕННЯ',signalLog:'ЖУРНАЛ СИГНАЛІВ',
  permanent:'Постійні покращення наступних забігів',visual:'Змінюй вигляд без впливу на баланс',darkMatter:'ТЕМНА МАТЕРІЯ',
  runLost:'RUN ПРОГРАНО',reached:'ДІЙШОВ',bank:'БАНК',build:'BUILD',
  revive:'▶ ВІДНОВИТИ RUN',reviveSub:'Повтори цей сектор. BUILD і банк RUN збережуться.',reviveSmall:'РЕКЛАМА // 1 РАЗ ЗА RUN',
  endDouble:'✦ ЗАВЕРШИТИ ×2',endDoubleSub:'Подивитися рекламу, завершити RUN і подвоїти всю нагороду.',
  end:'ЗАВЕРШИТИ RUN',endSub:'Забрати звичайну нагороду та одразу перейти в магазин.',
  reward:'НАГОРОДА',runEnded:'RUN ЗАВЕРШЕНО',shopReady:'Нагороду зараховано. Можеш витратити її зараз.',
  buffs:'БАФИ',mutation:'МУТАЦІЯ СЕКТОРУ',ffa:'Кожна фракція воює сама за себе.',
  pause:'ПАУЗА',sounds:'ЗВУКИ',resume:'ПРОДОВЖИТИ >>',language:'МОВА',pauseEnd:'ЗАВЕРШИТИ RUN',pauseEndAsk:'ТОЧНО ЗАВЕРШИТИ ПОТОЧНИЙ RUN?',pauseCancel:'СКАСУВАТИ',
  daily:'ЩОДЕННИЙ СИГНАЛ',milestones:'ЕТАПИ',achievements:'ДОСЯГНЕННЯ',
  categories:'КАТЕГОРІЇ',chooseOne:'ОБЕРИ ВАРІАНТ',equipped:'ВСТАНОВЛЕНО',owned:'КУПЛЕНО',free:'БЕЗКОШТОВНО',locked:'ЗАКРИТО',
  how:'ЩО ВОНО РОБИТЬ',stack:'Рівень',worksRun:'Працює до кінця поточного RUN.',selectedProtocols:'ВИБРАНІ ПРОТОКОЛИ',levelShort:'РІВ.',protocolInfo:'ПРОТОКОЛ У BUILD',close:'ЗАКРИТИ',rerollBank:'↻ REROLL ЗА RUN BANK',rerollUsed:'REROLL ВИКОРИСТАНО',runBankLabel:'RUN BANK',rerollHint:'Нові 3 варіанти без реклами',
  first:'1. ТВОЯ МЕРЕЖА',firstText:'Трикутник ▲ — твоя база. Коло ○ — нейтральний вузол. Ромб ◇ — ворог.',
  second:'2. ВІДПРАВ ФЛОТ',secondText:'Натисни свою базу → натисни ціль. Або протягни від бази до цілі.',
  third:'3. ЗАХОПИ СЕКТОР',thirdText:'Захопи всі ворожі вузли. Після перемоги обери Protocol — він працює до кінця RUN.',
  next:'ДАЛІ >>',deploy:'В БІЙ >>',skip:'ПРОПУСТИТИ'
 },
 ru:{
  back:'НАЗАД',choose:'ВЫБЕРИ 1 ПРОТОКОЛ',select:'ВЫБРАТЬ',details:'ПОДРОБНО',currentBuild:'ТЕКУЩИЙ BUILD',
  stacks:'СТЕКОВ',types:'ТИПОВ',shop:'МАГАЗИН',upgrades:'УЛУЧШЕНИЯ',styles:'ОФОРМЛЕНИЕ',signalLog:'ЖУРНАЛ СИГНАЛОВ',
  permanent:'Постоянные улучшения следующих забегов',visual:'Меняй внешний вид без влияния на баланс',darkMatter:'ТЁМНАЯ МАТЕРИЯ',
  runLost:'RUN ПРОИГРАН',reached:'ДОШЁЛ',bank:'БАНК',build:'BUILD',
  revive:'▶ ВОССТАНОВИТЬ RUN',reviveSub:'Повтори этот сектор. BUILD и банк RUN сохранятся.',reviveSmall:'РЕКЛАМА // 1 РАЗ ЗА RUN',
  endDouble:'✦ ЗАВЕРШИТЬ ×2',endDoubleSub:'Посмотреть рекламу, завершить RUN и удвоить всю награду.',
  end:'ЗАВЕРШИТЬ RUN',endSub:'Забрать обычную награду и сразу перейти в магазин.',
  reward:'НАГРАДА',runEnded:'RUN ЗАВЕРШЁН',shopReady:'Награда зачислена. Можешь потратить её сейчас.',
  buffs:'БАФФЫ',mutation:'МУТАЦИЯ СЕКТОРА',ffa:'Каждая фракция сражается сама за себя.',
  pause:'ПАУЗА',sounds:'ЗВУКИ',resume:'ПРОДОЛЖИТЬ >>',language:'ЯЗЫК',pauseEnd:'ЗАВЕРШИТЬ RUN',pauseEndAsk:'ТОЧНО ЗАВЕРШИТЬ ТЕКУЩИЙ RUN?',pauseCancel:'ОТМЕНА',
  daily:'ЕЖЕДНЕВНЫЙ СИГНАЛ',milestones:'ЭТАПЫ',achievements:'ДОСТИЖЕНИЯ',
  categories:'КАТЕГОРИИ',chooseOne:'ВЫБЕРИ ВАРИАНТ',equipped:'УСТАНОВЛЕНО',owned:'КУПЛЕНО',free:'БЕСПЛАТНО',locked:'ЗАКРЫТО',
  how:'ЧТО ОН ДЕЛАЕТ',stack:'Уровень',worksRun:'Работает до конца текущего RUN.',selectedProtocols:'ВЫБРАННЫЕ ПРОТОКОЛЫ',levelShort:'УР.',protocolInfo:'ПРОТОКОЛ В BUILD',close:'ЗАКРЫТЬ',rerollBank:'↻ REROLL ЗА RUN BANK',rerollUsed:'REROLL ИСПОЛЬЗОВАН',runBankLabel:'RUN BANK',rerollHint:'Новые 3 варианта без рекламы',
  first:'1. ТВОЯ СЕТЬ',firstText:'Треугольник ▲ — твоя база. Круг ○ — нейтральный узел. Ромб ◇ — враг.',
  second:'2. ОТПРАВЬ ФЛОТ',secondText:'Нажми свою базу → нажми цель. Или протяни от базы к цели.',
  third:'3. ЗАХВАТИ СЕКТОР',thirdText:'Захвати все вражеские узлы. После победы выбери Protocol — он действует до конца RUN.',
  next:'ДАЛЕЕ >>',deploy:'В БОЙ >>',skip:'ПРОПУСТИТЬ'
 },
 en:{
  back:'BACK',choose:'CHOOSE 1 PROTOCOL',select:'SELECT',details:'DETAILS',currentBuild:'CURRENT BUILD',
  stacks:'STACKS',types:'TYPES',shop:'SHOP',upgrades:'UPGRADES',styles:'SIGNAL STYLES',signalLog:'SIGNAL LOG',
  permanent:'Permanent upgrades for future runs',visual:'Change appearance without affecting balance',darkMatter:'DARK MATTER',
  runLost:'RUN LOST',reached:'REACHED',bank:'BANK',build:'BUILD',
  revive:'▶ REVIVE RUN',reviveSub:'Retry this sector. Your BUILD and RUN bank stay intact.',reviveSmall:'REWARDED AD // ONCE PER RUN',
  endDouble:'✦ END RUN ×2',endDoubleSub:'Watch an ad, end the RUN and double the entire payout.',
  end:'END RUN',endSub:'Take the normal payout and go straight to the shop.',
  reward:'REWARD',runEnded:'RUN ENDED',shopReady:'Reward banked. You can spend it now.',
  buffs:'BUFFS',mutation:'SECTOR MUTATION',ffa:'Every faction fights for itself.',
  pause:'PAUSED',sounds:'SFX',resume:'RESUME >>',language:'LANGUAGE',pauseEnd:'END RUN',pauseEndAsk:'END THE CURRENT RUN?',pauseCancel:'CANCEL',
  daily:'DAILY SIGNAL',milestones:'MILESTONES',achievements:'ACHIEVEMENTS',
  categories:'CATEGORIES',chooseOne:'CHOOSE ONE',equipped:'EQUIPPED',owned:'OWNED',free:'FREE',locked:'LOCKED',
  how:'WHAT IT DOES',stack:'Level',worksRun:'Active until the end of the current RUN.',selectedProtocols:'SELECTED PROTOCOLS',levelShort:'LVL',protocolInfo:'PROTOCOL IN BUILD',close:'CLOSE',rerollBank:'↻ REROLL WITH RUN BANK',rerollUsed:'REROLL USED',runBankLabel:'RUN BANK',rerollHint:'Get 3 new options without an ad',
  first:'1. YOUR NETWORK',firstText:'Triangle ▲ is your base. Circle ○ is neutral. Diamond ◇ is hostile.',
  second:'2. SEND A FLEET',secondText:'Tap your base → tap a target. Or drag from your base directly to the target.',
  third:'3. CLEAR THE SECTOR',thirdText:'Capture every hostile node. After a win, choose a Protocol for the rest of the RUN.',
  next:'NEXT >>',deploy:'DEPLOY >>',skip:'SKIP'
 }
};
const T=key=>UI[lang]?.[key]??UI.uk[key]??key;
window.GameLanguage={get:()=>lang,set:setLanguage,t:T};
window.V52Label=(key)=>({uk:{livePreview:'ПЕРЕГЛЯД У БОЮ',target:'ЦІЛЬ',capital:'СТОЛИЦЯ',drone:'ДРОН',trail:'СЛІД',fx:'FX'},ru:{livePreview:'ПРЕДПРОСМОТР В БОЮ',target:'ЦЕЛЬ',capital:'СТОЛИЦА',drone:'ДРОН',trail:'СЛЕД',fx:'FX'},en:{livePreview:'LIVE LOADOUT PREVIEW',target:'TARGET',capital:'CAPITAL',drone:'DRONE',trail:'TRAIL',fx:'FX'}}[lang]?.[key]||key);

const PROTO_TEXT={
 overdrive:['+15% швидкості флоту за стек.','+15% скорости флота за стек.','+15% fleet speed per stack.'],
 industrial:['+25% виробництва юнітів за стек.','+25% производства юнитов за стек.','+25% unit production per stack.'],
 storage:['+25 до ліміту юнітів на твоїх планетах.','+25 к лимиту юнитов на твоих планетах.','+25 unit capacity on your planets.'],
 vanguard:['+10 стартових юнітів у кожному секторі.','+10 стартовых юнитов в каждом секторе.','+10 starting units in every sector.'],
 reinforced:['-12% шкоди по твоїх планетах за стек.','-12% урона по твоим планетам за стек.','-12% damage taken by your planets per stack.'],
 swarm:['Відправляє +8% гарнізону за стек.','Отправляет +8% гарнизона за стек.','Sends +8% more of the garrison per stack.'],
 dense:['+0.25 сили кожної твоєї бойової одиниці.','+0.25 силы каждой боевой единицы.','+0.25 strength to every combat unit.'],
 raiders:['+12% шкоди проти ворожих планет.','+12% урона по вражеским планетам.','+12% damage against enemy planets.'],
 colonizer:['+15% шкоди проти нейтральних планет.','+15% урона по нейтральным планетам.','+15% damage against neutral planets.'],
 salvage:['+4 юніти на щойно захопленій планеті.','+4 юнита на только что захваченной планете.','+4 units on a newly captured planet.'],
 turret:['+1 шкоди захисних турелей твоїх баз.','+1 урона защитных турелей твоих баз.','+1 damage for your base defense drones.'],
 rapid:['Турелі твоїх баз стріляють швидше.','Турели твоих баз стреляют быстрее.','Your base defense drones fire faster.'],
 skimmer:['Астероїдні поля сповільнюють твій флот значно менше.','Астероидные поля намного меньше замедляют твой флот.','Asteroid fields slow your fleets much less.'],
 phase:['Після порталу твій флот отримує +35% швидкості.','После портала флот получает +35% скорости.','After a portal, your fleet gains +35% speed.'],
 phasearmor:['Прохід через портал додає +0.35 сили юніту.','Проход через портал добавляет +0.35 силы юниту.','Passing through a portal adds +0.35 unit strength.'],
 surge:['Перші 25 секунд сектору: +60% виробництва.','Первые 25 секунд сектора: +60% производства.','First 25 seconds of a sector: +60% production.'],
 capital:['+8 стартових юнітів і +0.5 шкоди турелей столиці.','+8 стартовых юнитов и +0.5 урона турелей столицы.','+8 starting units and +0.5 capital defense damage.'],
 harvest:['+10% Темної Матерії за очищення сектору за стек.','+10% Тёмной Материи за зачистку сектора за стак.','+10% Dark Matter from clearing a sector per stack.'],
 afterburn:['+20% швидкості флоту.','+20% скорости флота.','+20% fleet speed.'], forge:['+20% виробництва.','+20% производства.','+20% production.'],
 bulwark:['Ще -8% шкоди по твоїх планетах.','Ещё -8% урона по твоим планетам.','Another -8% damage taken by your planets.'],
 predator:['+20% шкоди по ворогу.','+20% урона по врагу.','+20% damage against enemies.'], seedcore:['+15 стартових юнітів.','+15 стартовых юнитов.','+15 starting units.'],
 riftmaster:['Портали дають ще +25% швидкості.','Порталы дают ещё +25% скорости.','Portals grant another +25% speed.'],
 pulsecore:['+10% швидкості та +12% виробництва.','+10% скорости и +12% производства.','+10% speed and +12% production.'],
 siegebreaker:['+35% шкоди по Capital/WARDEN вузлах.','+35% урона по узлам Capital/WARDEN.','+35% damage against Capital/WARDEN nodes.'],
 chainlink:['Захоплення дає +2 юніти кожній твоїй базі.','Захват даёт +2 юнита каждой твоей базе.','A capture gives +2 units to every owned base.'],
 voidwalker:['Слабше сповільнення астероїдами та менша зона втягування чорних дір.','Меньше замедление астероидами и меньше зона втягивания чёрных дыр.','Less asteroid slowdown and a smaller black-hole pull zone.'],
 deepreserve:['+35 capacity і +5 стартових юнітів.','+35 capacity и +5 стартовых юнитов.','+35 capacity and +5 starting units.'],
 overclock:['+35% виробництва, але -18% capacity.','+35% производства, но -18% capacity.','+35% production, but -18% capacity.'],
 glasscannon:['+30% шкоди по ворогу, але твої бази отримують +15% шкоди.','+30% урона врагу, но твои базы получают +15% урона.','+30% enemy damage, but your bases take +15% damage.'],
 emergencygrid:['+35% виробництва, коли в тебе лишилось 2 або менше вузлів.','+35% производства, когда у тебя осталось 2 узла или меньше.','+35% production when you own 2 nodes or fewer.'],
 signaljam:['AI атакує рідше та дає більше часу на перебудову.','AI атакует реже и даёт больше времени на перестройку.','AI attacks less often, giving you more time to regroup.'],
 frontline:['+10% шкоди по ворогу та +20% по нейтралах.','+10% урона врагу и +20% нейтралам.','+10% enemy damage and +20% neutral damage.'],
 reclaimer:['+8 юнітів після захоплення та +10% RUN reward.','+8 юнитов после захвата и +10% награды RUN.','+8 units after capture and +10% RUN reward.'],
 gatecrash:['Портал дає ще +35% speed і +0.60 сили.','Портал даёт ещё +35% speed и +0.60 силы.','A portal grants another +35% speed and +0.60 strength.'],
 momentum:['Перші 20 секунд сектору: +35% швидкості флоту.','Первые 20 секунд сектора: +35% скорости флота.','First 20 seconds of a sector: +35% fleet speed.'],
 fortress:['+20 capacity і +1.5 шкоди захисних турелей.','+20 capacity и +1.5 урона защитных турелей.','+20 capacity and +1.5 defense-drone damage.'],
 redline:['+45% швидкості флоту, але -20% місткості баз.','+45% скорости флота, но -20% вместимости баз.','+45% fleet speed, but -20% base capacity.'],
 bloodforge:['+45% виробництва, але твої бази отримують +20% шкоди.','+45% производства, но твои базы получают +20% урона.','+45% production, but your bases take +20% damage.'],
 warhunger:['+40% шкоди по ворогу, але AI стає агресивнішим.','+40% урона врагу, но AI становится агрессивнее.','+40% enemy damage, but AI becomes more aggressive.'],
 darktithe:['+35% нагороди RUN, але -10 стартових юнітів.','+35% награды RUN, но -10 стартовых юнитов.','+35% RUN reward, but -10 starting units.']
};
const META_TEXT={
 startcache:['+3 стартові юніти у кожному секторі.','+3 стартовых юнита в каждом секторе.','+3 starting units in every sector.'],
 reactor:['+5% постійного виробництва.','+5% постоянного производства.','+5% permanent production.'], navcore:['+5% постійної швидкості флоту.','+5% постоянной скорости флота.','+5% permanent fleet speed.'],
 archive1:['Відкриває 3 нові RARE-протоколи: AFTERBURN, NANO FORGE і BULWARK. Після покупки вони можуть випадати серед трьох покращень після очищення сектору.','Открывает 3 новых RARE-протокола: AFTERBURN, NANO FORGE и BULWARK. После покупки они могут появляться среди трёх улучшений после зачистки сектора.','Unlocks 3 new RARE Protocols: AFTERBURN, NANO FORGE and BULWARK. After purchase, they can appear among the three upgrade choices after clearing a sector.'],
 salvagecore:['+10% Dark Matter при завершенні RUN.','+10% Dark Matter при завершении RUN.','+10% Dark Matter when a RUN ends.'],
 cache2:['Ще +4 стартові юніти у кожному секторі.','Ещё +4 стартовых юнита в каждом секторе.','Another +4 starting units in every sector.'],
 archive2:['Відкриває ще 3 RARE-протоколи: PREDATOR, SEED CORE і RIFT MASTER. Вони додаються до пулу випадкових покращень між секторами.','Открывает ещё 3 RARE-протокола: PREDATOR, SEED CORE и RIFT MASTER. Они добавляются в пул случайных улучшений между секторами.','Unlocks 3 more RARE Protocols: PREDATOR, SEED CORE and RIFT MASTER. They are added to the random upgrade pool between sectors.'],
 archive3:['Відкриває 5 сильніших RARE-протоколів, які помітно змінюють build: PULSE CORE, SIEGE BREAKER, CHAIN LINK, VOID WALKER і DEEP RESERVE. Вони можуть випадати після перемоги в секторі.','Открывает 5 более сильных RARE-протоколов, заметно меняющих build: PULSE CORE, SIEGE BREAKER, CHAIN LINK, VOID WALKER и DEEP RESERVE. Они могут выпадать после победы в секторе.','Unlocks 5 stronger RARE Protocols that noticeably change your build: PULSE CORE, SIEGE BREAKER, CHAIN LINK, VOID WALKER and DEEP RESERVE. They can appear after winning a sector.'],
 salvage2:['Ще +10% Dark Matter при завершенні RUN.','Ещё +10% Dark Matter при завершении RUN.','Another +10% Dark Matter when a RUN ends.'],
 doctrine1:['Відкриває перші EPIC-протоколи. Це рідкісні покращення з дуже сильним ефектом; деякі мають мінус або особливу умову. Після покупки вони можуть випадати глибше в RUN.','Открывает первые EPIC-протоколы. Это редкие улучшения с очень сильным эффектом; у некоторых есть минус или особое условие. После покупки они могут выпадать глубже в RUN.','Unlocks the first EPIC Protocols. These are rare upgrades with very strong effects; some have a downside or special condition. After purchase they can appear deeper in a RUN.'],
 doctrine2:['Відкриває фінальний набір EPIC-протоколів: RECLAIMER, GATECRASH, MOMENTUM і FORTRESS. Вони доступні у пізніх секторах і дозволяють збирати найсильніші late-run build-и.','Открывает финальный набор EPIC-протоколов: RECLAIMER, GATECRASH, MOMENTUM и FORTRESS. Они доступны в поздних секторах и позволяют собирать самые сильные late-run build-ы.','Unlocks the final EPIC Protocol set: RECLAIMER, GATECRASH, MOMENTUM and FORTRESS. They become available in later sectors and enable the strongest late-run builds.']
};
const COS_TEXT={
 classic:['Чистий білий 1-bit сигнал.','Чистый белый 1-bit сигнал.','Clean white 1-bit signal.'], amber:['Теплий старий термінал.','Тёплый старый терминал.','Warm old-school terminal.'], phosphor:['Зелений радарний фосфор.','Зелёный радарный фосфор.','Green radar phosphor.'], void:['Холодний deep-space сигнал.','Холодный deep-space сигнал.','Cold deep-space signal.'], glitch:['Нестабільний цифровий канал.','Нестабильный цифровой канал.','Unstable digital channel.'],
 signal:['Класичний сигнал.','Классический сигнал.','Classic signal.'], fortress:['Кутова захисна рама.','Угловая защитная рама.','Angular defensive frame.'], prism:['Подвійне призматичне ядро.','Двойное призматическое ядро.','Dual prismatic core.'], warden:['Трофейна WARDEN-сигнатура.','Трофейная WARDEN-сигнатура.','Trophy WARDEN signature.'],
 vector:['Базовий ударний силует.','Базовый ударный силуэт.','Standard strike silhouette.'], shard:['Вузький швидкий профіль.','Узкий быстрый профиль.','Narrow fast profile.'], ring:['Кільцевий signal-профіль.','Кольцевой signal-профиль.','Ring signal profile.'], spike:['Агресивний late-run силует.','Агрессивный late-run силуэт.','Aggressive late-run silhouette.'],
 dots:['Піксельний дискретний слід.','Пиксельный дискретный след.','Discrete pixel trail.'], pulse:['Ритмічний імпульсний слід.','Ритмичный импульсный след.','Rhythmic pulse trail.'], phase:['Розірваний portal-style слід.','Разорванный portal-style след.','Broken portal-style trail.'], cross:['Різкий тактичний спалах.','Резкая тактическая вспышка.','Sharp tactical burst.'], scan:['Скан-лінії після захоплення.','Скан-линии после захвата.','Scan lines after capture.']
};

const COS_SLOT_TEXT={
 'capital:signal':['Класичне ядро командування.','Классическое командное ядро.','Classic command core.'],
 'trail:signal':['Чіткий стандартний слід.','Чёткий стандартный след.','Clean standard trail.'],
 'drone:ring':['Кільцевий signal-drone.','Кольцевой signal-drone.','Ring signal drone.'],
 'capture:ring':['Класична хвиля захоплення.','Классическая волна захвата.','Classic capture wave.'],
 'capture:void':['Імплозія з deep-space рамкою.','Имплозия с deep-space рамкой.','Implosion with a deep-space frame.']
};

const ACH_TEXT={
 first_run:['Заверши перший RUN.','Заверши первый RUN.','Finish your first RUN.'], deep8:['Дістанься сектора 008.','Доберись до сектора 008.','Reach Sector 008.'], capt50:['Захопи 50 вузлів загалом.','Захвати 50 узлов всего.','Capture 50 nodes total.'], events5:['Очисти 5 секторів з аномаліями.','Очисти 5 секторов с аномалиями.','Clear 5 anomaly sectors.'], proto20:['Обери 20 протоколів.','Выбери 20 протоколов.','Choose 20 Protocols.'], warden3:['Знищ 3 WARDEN-боси.','Уничтожь 3 WARDEN-босса.','Destroy 3 WARDEN bosses.'], warden5:['Знищ 5 WARDEN-босів.','Уничтожь 5 WARDEN-боссов.','Destroy 5 WARDEN bosses.'], veteran10:['Заверши 10 RUN.','Заверши 10 RUN.','Finish 10 RUNs.'], fullclear:['Заверши повний RUN.','Заверши полный RUN.','Complete a full RUN.'], deep40:['Дістанься сектора 040.','Доберись до сектора 040.','Reach Sector 040.']
};
const EVENT_TEXT={
 ion:['Іонний сплеск прискорює виробництво всіх фракцій.','Ионный всплеск ускоряет производство всех фракций.','Ion surge accelerates production for every faction.'],
 rift:['У секторі відкрився додатковий нестабільний портал.','В секторе открылся дополнительный нестабильный портал.','An extra unstable portal has opened in the sector.'],
 debris:['Маршрути перекриті додатковими полями уламків.','Маршруты перекрыты дополнительными полями обломков.','Routes are blocked by extra debris fields.'],
 hunter:['Ворог агресивніший і швидше виробляє флот.','Враг агрессивнее и быстрее производит флот.','The enemy is more aggressive and produces fleets faster.'],
 cache:['Нейтральні вузли ослаблені — шанс швидко розігнати економіку.','Нейтральные узлы ослаблены — шанс быстро разогнать экономику.','Neutral nodes are weakened — a chance to snowball quickly.'],
 gravity:['Флоти рухаються повільніше — маршрути стають важливішими.','Флоты движутся медленнее — маршруты становятся важнее.','Fleets move slower, making routes more important.']
};
function idx(){return lang==='uk'?0:lang==='ru'?1:2;}
function applyDataLanguage(){
  try{ PROTOCOLS.forEach(p=>{if(PROTO_TEXT[p.id])p.desc=PROTO_TEXT[p.id][idx()];}); }catch(e){}
  try{ META_NODES.forEach(n=>{if(META_TEXT[n.id])n.desc=META_TEXT[n.id][idx()];}); }catch(e){}
  try{ ACHIEVEMENTS.forEach(a=>{if(ACH_TEXT[a.id])a.desc=ACH_TEXT[a.id][idx()];}); }catch(e){}
  try{ SECTOR_EVENTS.forEach(e=>{if(EVENT_TEXT[e.id])e.desc=EVENT_TEXT[e.id][idx()];}); }catch(e){}
  try{ window.CosmeticsSystem?.ITEMS?.forEach(i=>{const tr=COS_SLOT_TEXT[`${i.slot}:${i.id}`]||COS_TEXT[i.id];if(tr)i.desc=tr[idx()];}); }catch(e){}
}


const PHRASES=[
 ['ЩО ХОЧЕШ ПОКРАЩИТИ?','ЧТО ХОЧЕШЬ УЛУЧШИТЬ?','WHAT DO YOU WANT TO IMPROVE?'],
 ['Натисни на блок — одразу побачиш доступні варіанти.','Нажми на блок — сразу увидишь доступные варианты.','Tap a block to see the available options immediately.'],
 ['БОЙОВІ / СТАРТОВІ БОНУСИ','БОЕВЫЕ / СТАРТОВЫЕ БОНУСЫ','COMBAT / START BONUSES'],
 ['Швидкість, production, стартові юніти','Скорость, production, стартовые юниты','Speed, production, starting units'],
 ['НОВІ ВАРІАНТИ BUILD','НОВЫЕ ВАРИАНТЫ BUILD','NEW BUILD OPTIONS'],
 ['Відкривай RARE та EPIC Protocols','Открывай RARE и EPIC Protocols','Unlock RARE and EPIC Protocols'],
 ['DARK MATTER / НАГОРОДИ','DARK MATTER / НАГРАДЫ','DARK MATTER / REWARDS'],
 ['Більше користі з кожного завершеного RUN','Больше пользы с каждого завершённого RUN','Get more value from every completed RUN'],
 ['Подивись вигляд прямо як у секторі','Посмотри внешний вид прямо как в секторе','Preview the look exactly as it appears in a sector'],
 ['Натисни апгрейд: побачиш що зміниться, опис і кнопку покупки.','Нажми улучшение: увидишь изменение, описание и кнопку покупки.','Tap an upgrade to see the change, details and buy button.'],
 ['ПІСЛЯ','ПОСЛЕ','AFTER'],
 ['МАГАЗИН','МАГАЗИН','SHOP'],['ПОКРАЩЕННЯ','УЛУЧШЕНИЯ','UPGRADES'],['ОФОРМЛЕННЯ','ОФОРМЛЕНИЕ','SIGNAL STYLES'],['ЗАВДАННЯ','ЗАДАНИЯ','TASKS'],['ЖУРНАЛ СИГНАЛІВ','ЖУРНАЛ СИГНАЛОВ','SIGNAL LOG'],
 ['СИЛА','СИЛА','POWER'],['ПРОТОКОЛИ','ПРОТОКОЛЫ','PROTOCOLS'],['ЕКОНОМІКА','ЭКОНОМИКА','ECONOMY'],['ТЕМНА МАТЕРІЯ','ТЁМНАЯ МАТЕРИЯ','DARK MATTER'],
 ['ПОСТІЙНИЙ ПРОГРЕС','ПОСТОЯННЫЙ ПРОГРЕСС','PERMANENT PROGRESSION'],['ВІЗУАЛЬНЕ ОФОРМЛЕННЯ // БЕЗ СИЛИ','ВИЗУАЛЬНОЕ ОФОРМЛЕНИЕ // БЕЗ СИЛЫ','VISUAL LOADOUT // NO POWER'],
 ['КАТЕГОРІЇ','КАТЕГОРИИ','CATEGORIES'],['КРОК 2 // ОБЕРИ ВАРІАНТ','ШАГ 2 // ВЫБЕРИ ВАРИАНТ','STEP 2 // CHOOSE ONE'],
 ['ВСТАНОВЛЕНО','УСТАНОВЛЕНО','EQUIPPED'],['КУПЛЕНО','КУПЛЕНО','OWNED'],['БЕЗКОШТОВНО','БЕСПЛАТНО','FREE'],['ЗАКРИТО','ЗАКРЫТО','LOCKED'],
 ['ЩОДЕННИЙ СИГНАЛ','ЕЖЕДНЕВНЫЙ СИГНАЛ','DAILY SIGNAL'],['НАСТУПНИЙ ЕТАП','СЛЕДУЮЩИЙ ЭТАП','NEXT MILESTONE'],['ДОСЯГНЕННЯ','ДОСТИЖЕНИЯ','ACHIEVEMENTS'],
 ['ДОВГОСТРОКОВІ ЦІЛІ','ДОЛГОСРОЧНЫЕ ЦЕЛИ','LONG-TERM GOALS'],['ВСЕ ВИКОНАНО','ВСЁ ВЫПОЛНЕНО','ALL CLEARED'],['ВИКОНАНО','ВЫПОЛНЕНО','COMPLETED'],
 ['ВІДКРИТО','ОТКРЫТО','UNLOCKED'],['ЗАБРАТИ','ЗАБРАТЬ','CLAIM'],['ПРИДБАТИ','КУПИТЬ','BUY'],['ПОТРІБНО','ТРЕБУЕТСЯ','REQUIRES'],['НЕ ВИСТАЧАЄ','НЕ ХВАТАЕТ','NEED'],
 ['ПОТОЧНИЙ BUILD','ТЕКУЩИЙ BUILD','CURRENT BUILD'],['BUILD ОНОВЛЕНО','BUILD ОБНОВЛЁН','BUILD UPDATED'],['НАСТУПНИЙ СЕКТОР','СЛЕДУЮЩИЙ СЕКТОР','NEXT SECTOR'],
 ['СЕКТОР ОЧИЩЕНО','СЕКТОР ОЧИЩЕН','SECTOR CLEAR'],['RUN ЗАВЕРШЕНО','RUN ЗАВЕРШЁН','RUN COMPLETE'],['РЕЗУЛЬТАТ RUN','РЕЗУЛЬТАТ RUN','RUN RESULT'],
 ['ПОВНЕ ОЧИЩЕННЯ','ПОЛНАЯ ЗАЧИСТКА','FULL CLEAR'],['УСІ 5 АКТІВ ПРОЙДЕНО','ВСЕ 5 АКТОВ ПРОЙДЕНЫ','ALL 5 ACTS CLEARED'],
 ['ЗАХОПЛЕНО','ЗАХВАЧЕНО','CAPTURED'],['НАГОРОДА','НАГРАДА','REWARD'],['БАНК RUN','БАНК RUN','RUN BANK'],['ПРОГРЕС','ПРОГРЕСС','PROGRESS'],
 ['НАЗАД','НАЗАД','BACK'],['ДЕТАЛЬНО','ПОДРОБНО','DETAILS'],['ЩО ВОНО РОБИТЬ','ЧТО ОН ДЕЛАЕТ','WHAT IT DOES'],
 ['ПАУЗА','ПАУЗА','PAUSED'],['ЗВУКИ','ЗВУКИ','SFX'],['МОВА','ЯЗЫК','LANGUAGE'],['ПРОДОВЖИТИ >>','ПРОДОЛЖИТЬ >>','RESUME >>'],
 ['ЗАПУСТИТИ RUN','ЗАПУСТИТЬ RUN','START RUN'],['НОВИЙ RUN','НОВЫЙ RUN','NEW RUN'],['НОВИЙ RUN >>','НОВЫЙ RUN >>','NEW RUN >>'],
 ['ШВИДКІСТЬ ФЛОТУ','СКОРОСТЬ ФЛОТА','FLEET SPEED'],['ВИРОБНИЦТВО','ПРОИЗВОДСТВО','PRODUCTION'],['БОНУС ЛІМІТУ','БОНУС ЛИМИТА','CAP BONUS'],['СТАРТОВІ ЮНІТИ','СТАРТОВЫЕ ЮНИТЫ','START UNITS'],['ОТРИМАНА ШКОДА','ПОЛУЧАЕМЫЙ УРОН','DAMAGE TAKEN'],['ЧАСТКА ВІДПРАВКИ','ДОЛЯ ОТПРАВКИ','SEND RATIO'],['СИЛА ЮНІТА','СИЛА ЮНИТА','UNIT POWER'],['ШКОДА ВОРОГУ','УРОН ВРАГУ','ENEMY DAMAGE'],['ШКОДА НЕЙТРАЛАМ','УРОН НЕЙТРАЛАМ','NEUTRAL DAMAGE'],['БОНУС ЗАХОПЛЕННЯ','БОНУС ЗАХВАТА','CAPTURE BONUS'],['ШКОДА ТУРЕЛЕЙ','УРОН ТУРЕЛЕЙ','TURRET DAMAGE'],['ПЕРЕЗАРЯДКА ТУРЕЛЕЙ','ПЕРЕЗАРЯДКА ТУРЕЛЕЙ','TURRET COOLDOWN'],['ШВИДКІСТЬ У ПОЛІ','СКОРОСТЬ В ПОЛЕ','FIELD SPEED'],['ШВИДКІСТЬ ПОРТАЛУ','СКОРОСТЬ ПОРТАЛА','PORTAL SPEED'],['СИЛА ПІСЛЯ ПОРТАЛУ','СИЛА ПОСЛЕ ПОРТАЛА','PORTAL POWER'],['СТАРТОВЕ ВИРОБНИЦТВО','СТАРТОВОЕ ПРОИЗВОДСТВО','OPENING PROD'],['ТУРЕЛЬ СТОЛИЦІ','ТУРЕЛЬ СТОЛИЦЫ','CAPITAL TURRET'],['НАГОРОДА RUN','НАГРАДА RUN','RUN REWARD'],['ШКОДА БОСУ','УРОН БОССУ','BOSS DAMAGE'],['УСІ БАЗИ / ЗАХОПЛЕННЯ','ВСЕ БАЗЫ / ЗАХВАТ','ALL BASES / CAPTURE'],['ЗОНА ЧОРНОЇ ДІРИ','ЗОНА ЧЁРНОЙ ДЫРЫ','BLACK HOLE ZONE'],['МІСТКІСТЬ','ВМЕСТИМОСТЬ','CAPACITY'],['ВИРОБНИЦТВО ПРИ ВІДСТАВАННІ','ПРОИЗВОДСТВО ПРИ ОТСТАВАНИИ','COMEBACK PROD'],['ТИСК AI','ДАВЛЕНИЕ AI','AI PRESSURE'],['СТАРТОВА ШВИДКІСТЬ','СТАРТОВАЯ СКОРОСТЬ','OPENING SPEED'],['ЕФЕКТ','ЭФФЕКТ','EFFECT'],['ПОТОЧНЕ','ТЕКУЩЕЕ','CURRENT'],['ПОКРАЩЕНЕ','УЛУЧШЕННОЕ','UPGRADED'],
 ['СТИЛЬ СИГНАЛУ','СТИЛЬ СИГНАЛА','SIGNAL STYLE'],['СТОЛИЦЯ','СТОЛИЦА','CAPITAL'],['ДРОН','ДРОН','DRONE'],['СЛІД','СЛЕД','TRAIL'],['ЕФЕКТ ЗАХОПЛЕННЯ','ЭФФЕКТ ЗАХВАТА','CAPTURE FX'],
 ['КРАЩИЙ','ЛУЧШИЙ','BEST'],['ВАЛЮТА','ВАЛЮТА','CURRENCY'],['ПОВНІ ПРОХОДЖЕННЯ','ПОЛНЫЕ ПРОХОЖДЕНИЯ','FULL CLEARS'],['ПРОГРАНІ ЗАБІГИ','ПРОИГРАННЫЕ ЗАБЕГИ','LOST RUNS'],['ЗАБІГ','ЗАБЕГ','RUN'],['40 СЕКТОРІВ // 5 АКТІВ','40 СЕКТОРОВ // 5 АКТОВ','40 SECTORS // 5 ACTS'],['ТАКТИЧНИЙ NODE ROGUELITE','ТАКТИЧЕСКИЙ NODE ROGUELITE','TACTICAL NODE ROGUELITE'],
 ['ПОСИЛЕНІ ПРОТОКОЛИ // СТАРТОВІ OUTPOST УВІМКНЕНО','УСИЛЕННЫЕ ПРОТОКОЛЫ // СТАРТОВЫЕ OUTPOST ВКЛЮЧЕНЫ','AMPLIFIED PROTOCOLS // OUTPOST SIGNALS ONLINE'],['OVERCHARGED BUILD // СТАРТОВА ТЕРИТОРІЯ АКТИВНА','OVERCHARGED BUILD // СТАРТОВАЯ ТЕРРИТОРИЯ АКТИВНА','OVERCHARGED BUILD // STARTING TERRITORY ACTIVE'],['ASCENDANT BUILD // МОЖЛИВІ ПОДВІЙНІ OUTPOST','ASCENDANT BUILD // ВОЗМОЖНЫ ДВОЙНЫЕ OUTPOST','ASCENDANT BUILD // DOUBLE OUTPOSTS POSSIBLE'],['SINGULARITY BUILD // МАКСИМАЛЬНИЙ ТИСК RUN','SINGULARITY BUILD // МАКСИМАЛЬНОЕ ДАВЛЕНИЕ RUN','SINGULARITY BUILD // MAXIMUM RUN PRESSURE'],['ЗРОСТАННЯ ТИСКУ RUN','РОСТ ДАВЛЕНИЯ RUN','RUN SIGNAL ESCALATION'],
 ['Постійні бойові / стартові бонуси','Постоянные боевые / стартовые бонусы','Permanent combat/start bonuses'],
 ['Відкриває нові варіанти BUILD','Открывает новые варианты BUILD','Unlock new run-build options'],['Збільшує повернення Dark Matter','Увеличивает возврат Dark Matter','Increase Dark Matter return'],
 ['Класична хвиля захоплення.','Классическая волна захвата.','Classic capture wave.'],['Класичне ядро командування.','Классическое командное ядро.','Classic command core.'],['Чіткий стандартний слід.','Чёткий стандартный след.','Clean standard trail.'],['Кільцевий signal-drone.','Кольцевой signal-drone.','Ring signal drone.'],['Імплозія з deep-space рамкою.','Имплозия с deep-space рамкой.','Implosion with a deep-space frame.'],
 ['ПІДКЛЮЧЕННЯ ДО РЕКЛАМИ…','ПОДКЛЮЧЕНИЕ К РЕКЛАМЕ…','CONNECTING TO AD…'],['НАГОРОДУ ОТРИМАНО','НАГРАДА ПОЛУЧЕНА','REWARD RECEIVED'],['РЕКЛАМА НЕ ВІДПОВІДАЄ','РЕКЛАМА НЕ ОТВЕЧАЕТ','AD NOT RESPONDING'],['РЕКЛАМА НЕДОСТУПНА','РЕКЛАМА НЕДОСТУПНА','AD UNAVAILABLE'],['РЕКЛАМУ ПРОПУЩЕНО','РЕКЛАМА ПРОПУЩЕНА','AD SKIPPED'],['ПОМИЛКА РЕКЛАМИ','ОШИБКА РЕКЛАМЫ','AD ERROR'],
 ['Реклама → замінити всі 3 протоколи','Реклама → заменить все 3 протокола','Ad → replace all 3 Protocols'],['1 раз на вибір','1 раз на выбор','Once per choice'],['LOCAL TEST // нагорода видається без реальної реклами','LOCAL TEST // награда выдаётся без реальной рекламы','LOCAL TEST // reward granted without a real ad'],
 ['Пауза','Пауза','Pause'],['Скинути прогрес','Сбросить прогресс','Reset progress'],['Гучність звуків','Громкость звуков','SFX volume'],
 ['Працює постійно у всіх майбутніх RUN.','Работает постоянно во всех будущих RUN.','Permanent across all future RUNs.'],['Додається поверх START CACHE I.','Добавляется поверх START CACHE I.','Stacks on top of START CACHE I.'],['Складається із SALVAGE CORE I.','Складывается с SALVAGE CORE I.','Stacks with SALVAGE CORE I.'],
 ['Додає 3 нові RARE Protocols у майбутні вибори.','Добавляет 3 новых RARE Protocols в будущий выбор.','Adds 3 new RARE Protocols to future choices.'],['Додає ще 3 RARE Protocols.','Добавляет ещё 3 RARE Protocols.','Adds 3 more RARE Protocols.'],['Додає 5 build-changing RARE Protocols.','Добавляет 5 build-changing RARE Protocols.','Adds 5 build-changing RARE Protocols.'],
 ['Відкриває перший пакет EPIC Protocols із сильними плюсами та trade-off.','Открывает первый набор EPIC Protocols с сильными плюсами и trade-off.','Unlocks the first EPIC Protocol pack with strong benefits and trade-offs.'],['Відкриває фінальний пакет EPIC Protocols для deep-run білдів.','Открывает финальный пакет EPIC Protocols для deep-run билдов.','Unlocks the final EPIC Protocol pack for deep-run builds.'],
 ['Кожен новий сектор починається з додатковими юнітами на твоїх стартових базах.','Каждый новый сектор начинается с дополнительными юнитами на стартовых базах.','Every new sector starts with extra units on your starting bases.'],['Прискорює всі твої флоти без негативного ефекту.','Ускоряет все твои флоты без негативного эффекта.','Speeds up all your fleets with no downside.'],['Бонус застосовується до Dark Matter, яку ти банкуєш після завершення RUN.','Бонус применяется к Dark Matter, которую ты сохраняешь после завершения RUN.','The bonus applies to Dark Matter banked at the end of a RUN.']
];
function phraseTranslate(t){for(const row of PHRASES){if(row.includes(t))return row[lang==='uk'?0:lang==='ru'?1:2];}return null;}

const EXACT={
 'ЗАВДАННЯ':{ru:'ЗАДАНИЯ',en:'TASKS'}, 'TASKS':{ru:'ЗАДАНИЯ',en:'TASKS'},
 'ПРОДОВЖИТИ >>':{ru:'ПРОДОЛЖИТЬ >>',en:'RESUME >>'}, 'ЗВУКИ':{ru:'ЗВУКИ',en:'SFX'}, 'ПАУЗА':{ru:'ПАУЗА',en:'PAUSED'},
 'ПРОПУСТИТИ':{ru:'ПРОПУСТИТЬ',en:'SKIP'}, 'ДАЛІ >>':{ru:'ДАЛЕЕ >>',en:'NEXT >>'}, 'В БІЙ >>':{ru:'В БОЙ >>',en:'DEPLOY >>'},
 'ІНШІ АПГРЕЙДИ':{ru:'ДРУГИЕ УЛУЧШЕНИЯ',en:'OTHER UPGRADES'}, 'КАТЕГОРІЇ':{ru:'КАТЕГОРИИ',en:'CATEGORIES'},
 'ОБЕРИ ЩО МІНЯЄМО · 2. ОБЕРИ ВАРІАНТ · 3. ПЕРЕВІР У LIVE PREVIEW':{ru:'ВЫБЕРИ ЧТО МЕНЯЕМ · 2. ВЫБЕРИ ВАРИАНТ · 3. ПРОВЕРЬ В LIVE PREVIEW',en:'CHOOSE A SLOT · 2. CHOOSE A VARIANT · 3. CHECK LIVE PREVIEW'},
 'Показано разом з усіма твоїми зараз екіпірованими стилями. Вибраний предмет тимчасово підміняє тільки свій слот.':{ru:'Показано вместе со всем текущим оформлением. Выбранный предмет временно заменяет только свой слот.',en:'Shown with your current loadout. The selected item temporarily replaces only its own slot.'},
 'Постійно посилюй наступні RUN':{ru:'Постоянно усиливай следующие RUN',en:'Permanently strengthen future RUNs'},
 'Змінюй вигляд без впливу на баланс':{ru:'Меняй внешний вид без влияния на баланс',en:'Change appearance without affecting balance'},
 'Протоколи ще не вибрані':{ru:'Протоколы ещё не выбраны',en:'No Protocols selected yet'},
 'Кожна фракція воює сама за себе.':{ru:'Каждая фракция сражается сама за себя.',en:'Every faction fights for itself.'},
 'Очисти сектори сьогодні':{ru:'Очищай секторы сегодня',en:'Clear sectors today'}, 'Захопи вузли сьогодні':{ru:'Захватывай узлы сегодня',en:'Capture nodes today'}, 'Обери протоколи сьогодні':{ru:'Выбирай протоколы сегодня',en:'Choose Protocols today'}
};
function localizeText(s){
  const t=String(s||'').trim(); if(!t) return s;
  const phr=phraseTranslate(t); if(phr) return String(s).replace(t,phr);
  if(lang==='uk') return s;
  if(EXACT[t]?.[lang]) return String(s).replace(t,EXACT[t][lang]);
  // Common dynamic labels.
  let out=String(s);
  const repl=lang==='ru' ? [
    [/СЕКТОР/gi,'СЕКТОР'],[/НАСТУПНИЙ/gi,'СЛЕДУЮЩИЙ'],[/НАГОРОДА/gi,'НАГРАДА'],[/ЗАВЕРШИТИ/gi,'ЗАВЕРШИТЬ'],[/ВИБРАТИ/gi,'ВЫБРАТЬ'],[/КУПИТИ/gi,'КУПИТЬ'],[/НЕ ВИСТАЧАЄ/gi,'НЕ ХВАТАЕТ'],[/ПОТРІБНО/gi,'НУЖНО']
  ] : [
    [/СЕКТОР/gi,'SECTOR'],[/НАСТУПНИЙ/gi,'NEXT'],[/НАГОРОДА/gi,'REWARD'],[/ЗАВЕРШИТИ/gi,'END'],[/ВИБРАТИ/gi,'SELECT'],[/КУПИТИ/gi,'BUY'],[/НЕ ВИСТАЧАЄ/gi,'NEED'],[/ПОТРІБНО/gi,'REQUIRES']
  ];
  repl.forEach(([a,b])=>out=out.replace(a,b)); return out;
}
function translateDOM(root=document.body){
  if(!root) return;
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let n;
  while((n=walker.nextNode())){if(n.parentElement?.closest('script,style,canvas'))continue;const v=localizeText(n.nodeValue);if(v!==n.nodeValue)n.nodeValue=v;}
  // Static controls that should always follow the selected language.
  const br=$('btnResumeGame');if(br&&br.textContent!==T('resume'))br.textContent=T('resume');
  const bs=$('btnOnboardingSkip');if(bs&&bs.textContent!==T('skip'))bs.textContent=T('skip');
  const ph=document.querySelector('.pause-card h2');if(ph&&ph.textContent!==T('pause'))ph.textContent=T('pause');
  const sh=document.querySelector('.pause-setting-head span');if(sh&&sh.textContent!==T('sounds'))sh.textContent=T('sounds');
  const pe=$('btnPauseEndRun');if(pe&&pe.textContent!==T('pauseEnd'))pe.textContent=T('pauseEnd');
  const pet=$('pauseEndConfirmText');if(pet&&pet.textContent!==T('pauseEndAsk'))pet.textContent=T('pauseEndAsk');
  const pec=$('btnPauseEndCancel');if(pec&&pec.textContent!==T('pauseCancel'))pec.textContent=T('pauseCancel');
  const pey=$('btnPauseEndConfirm');if(pey&&pey.textContent!==T('pauseEnd'))pey.textContent=T('pauseEnd');
  root.querySelectorAll?.('[aria-label]').forEach(el=>{const v=localizeText(el.getAttribute('aria-label'));if(v&&v!==el.getAttribute('aria-label'))el.setAttribute('aria-label',v);});
}
function rerenderLanguage(){
  document.documentElement.lang=lang;
  applyDataLanguage();
  try{updateShopUI();}catch(e){}
  try{renderProtocolChoice();}catch(e){}
  try{if(gameState==='playing')updateSectorAlert();}catch(e){}
  translateDOM(); renderLangBars(); renderBuffHUD();
}
function applyAutomaticLanguage(raw,source='platform'){
  if(savedManualLang()) return false;
  const next=localeToGameLang(raw); if(!LANGS.includes(next)) return false;
  try{localStorage.setItem('1bitAutoLang',next);}catch(e){}
  if(next===lang) return true;
  const prev=lang; lang=next; document.documentElement.lang=lang;
  window.GameTelemetry?.track?.('language_auto',{from:prev,to:lang,source});
  rerenderLanguage(); return true;
}
function setLanguage(next){
  if(!LANGS.includes(next))return;
  const prev=lang;lang=next;
  try{localStorage.setItem('1bitLang',lang);localStorage.removeItem('1bitAutoLang');}catch(e){}
  document.documentElement.lang=lang;
  window.GameTelemetry?.track?.('language_change',{from:prev,to:lang});
  rerenderLanguage();
}
function renderLangBars(){
  document.querySelectorAll('.v52-langbar').forEach(bar=>{bar.innerHTML=`<span>${T('language')}</span>${LANGS.map(x=>`<button class="${x===lang?'active':''}" data-lang="${x}">${x.toUpperCase()}</button>`).join('')}`;bar.querySelectorAll('[data-lang]').forEach(b=>b.onclick=()=>setLanguage(b.dataset.lang));});
}
function ensureLangBars(){
  const pause=document.querySelector('.pause-card');if(pause&&!pause.querySelector('.v52-langbar')){const d=document.createElement('div');d.className='v52-langbar';pause.insertBefore(d,pause.querySelector('.pause-actions'));}
  const ob=document.querySelector('.onboarding-card');if(ob&&!ob.querySelector('.v52-langbar')){const d=document.createElement('div');d.className='v52-langbar onboarding-lang';ob.insertBefore(d,ob.firstChild);}
  renderLangBars();
}
const observer=new MutationObserver(ms=>{for(const m of ms){if(m.type==='childList'){m.addedNodes.forEach(n=>{if(n.nodeType===1||n.nodeType===3)translateDOM(n.nodeType===1?n:n.parentNode);});}}});
observer.observe(document.body,{childList:true,subtree:true});
applyDataLanguage();ensureLangBars();translateDOM();



window.addEventListener('message',ev=>{try{
  const loc=ev.data?.playdeck?.method==='getUserProfile'?ev.data.playdeck.value?.locale:null;
  if(loc) applyAutomaticLanguage(loc,'playdeck');
}catch(e){}});

// -------------------------------------------------------------------------
// PROTOCOL CHOICE: expand inside the list, never navigate to another screen.
// -------------------------------------------------------------------------
const SPECIAL_DETAIL={
 rapid:{uk:'Захисні дрони автоматично стріляють частіше, коли ворожий флот входить у радіус бази.',ru:'Защитные дроны автоматически стреляют чаще, когда вражеский флот входит в радиус базы.',en:'Defense drones automatically fire more often when an enemy fleet enters base range.'},
 phase:{uk:'Бонус активується після проходження порталу і діє на цей флот.',ru:'Бонус активируется после прохода через портал и действует на этот флот.',en:'The bonus activates after passing through a portal and applies to that fleet.'},
 surge:{uk:'Ефект діє тільки перші 25 секунд кожного сектору.',ru:'Эффект действует только первые 25 секунд каждого сектора.',en:'The effect lasts only for the first 25 seconds of each sector.'},
 overclock:{uk:'Сильний приріст виробництва має ціну: максимальна місткість твоїх баз зменшується.',ru:'Сильный прирост производства имеет цену: максимальная вместимость баз уменьшается.',en:'The production boost comes with a trade-off: your maximum base capacity is reduced.'},
 glasscannon:{uk:'Ти завдаєш значно більше шкоди, але твої бази також стають вразливішими.',ru:'Ты наносишь намного больше урона, но твои базы тоже становятся уязвимее.',en:'You deal much more damage, but your bases also become more vulnerable.'},
 emergencygrid:{uk:'Бонус автоматично вмикається, коли під твоїм контролем лишається 2 вузли або менше.',ru:'Бонус автоматически включается, когда под твоим контролем остаётся 2 узла или меньше.',en:'The bonus activates automatically when you control 2 nodes or fewer.'},
 redline:{uk:'CORRUPTED-протокол: величезний приріст швидкості обмінюється на меншу місткість усіх твоїх баз.',ru:'CORRUPTED-протокол: огромный прирост скорости обменивается на меньшую вместимость всех твоих баз.',en:'CORRUPTED Protocol: a huge speed boost is traded for lower capacity on every base.'},
 bloodforge:{uk:'CORRUPTED-протокол: production різко зростає, але будь-яка атака по твоїх базах стає небезпечнішою.',ru:'CORRUPTED-протокол: production резко растёт, но любая атака по твоим базам становится опаснее.',en:'CORRUPTED Protocol: production surges, but every attack against your bases becomes more dangerous.'},
 warhunger:{uk:'CORRUPTED-протокол: ти сильніше пробиваєш ворога, але всі AI частіше приймають агресивні рішення.',ru:'CORRUPTED-протокол: ты сильнее пробиваешь врага, но все AI чаще принимают агрессивные решения.',en:'CORRUPTED Protocol: you hit enemies harder, but every AI makes aggressive decisions more often.'},
 darktithe:{uk:'CORRUPTED-протокол: кожна наступна нагорода RUN більша, але кожен сектор починається з меншої армії.',ru:'CORRUPTED-протокол: каждая следующая награда RUN больше, но каждый сектор начинается с меньшей армии.',en:'CORRUPTED Protocol: every following RUN reward is larger, but each sector starts with fewer units.'}
};
function protoDetails(p){
  const rows=protocolCompareRows(p).slice(0,2);
  const detail=SPECIAL_DETAIL[p.id]?.[lang]||'';
  return `<div class="v52-proto-details"><small>${T('how')}</small><p>${esc(p.desc)}</p>${rows.map(r=>`<div class="v52-effect"><span>${esc(localizeText(r.label))}</span><b>${esc(r.before)} → ${esc(r.after)}</b></div>`).join('')}${detail?`<p class="v52-detail-note">${esc(detail)}</p>`:''}<div class="v52-stackline">${T('stack')}: <b>${protocolCount(p.id)}/${p.max}</b> → <b>${Math.min(p.max,protocolCount(p.id)+1)}/${p.max}</b></div><button class="v5-primary" data-v52-pick="${p.id}">${T('select')} ${esc(p.name)}</button></div>`;
}
function protocolLevelMarks(p,count=protocolCount(p.id)){
  if((p.max||1)<=1) return '';
  return `<span class="v593-level-marks" aria-label="${T('stack')} ${count}/${p.max}">${Array.from({length:p.max},(_,i)=>`<i class="${i<count?'on':''}"></i>`).join('')}</span>`;
}
function selectedProtocolsMarkup(){
  const runRarityOrder=['COMMON','RARE','EPIC','CORRUPTED'];
  const rows=PROTOCOLS.filter(p=>protocolCount(p.id)>0).sort((a,b)=>{const r=runRarityOrder.indexOf(a.rarity||'COMMON')-runRarityOrder.indexOf(b.rarity||'COMMON');return r||a.name.localeCompare(b.name);});
  if(!rows.length) return '';
  return `<section class="v593-selected-tree"><small>${T('selectedProtocols')}</small><div class="v593-tree-list">${rows.map(p=>{const rarity=String(p.rarity||'COMMON').toLowerCase();return `<button class="v593-tree-card ${rarity}" data-run-protocol-info="${p.id}"><b>${esc(p.name)}</b>${protocolLevelMarks(p)}</button>`;}).join('')}</div></section>`;
}
function selectedProtocolInfoMarkup(p){
  const count=protocolCount(p.id); const rarity=String(p.rarity||'COMMON').toLowerCase(); const extra=SPECIAL_DETAIL[p.id]?.[lang]||'';
  return `<div class="v593-proto-info-overlay" data-v593-info-overlay><section class="v593-proto-info ${rarity}" role="dialog" aria-modal="true" aria-label="${esc(p.name)}"><button class="v593-info-close" data-v593-info-close aria-label="${T('close')}">×</button><small>${T('protocolInfo')} // ${esc(p.rarity||'COMMON')} // ${esc(p.cat.toUpperCase())}</small><div class="v593-info-title"><span>${esc(p.icon)}</span><b>${esc(p.name)}</b></div>${protocolLevelMarks(p,count)}<p>${esc(p.desc)}</p>${extra?`<em>${esc(extra)}</em>`:''}${(p.max||1)>1?`<div class="v593-info-level">${T('stack')}: <b>${count}/${p.max}</b></div>`:''}</section></div>`;
}
function bindSelectedProtocolInfo(panel){
  panel.querySelectorAll('[data-run-protocol-info]').forEach(btn=>btn.addEventListener('click',()=>{
    const p=PROTOCOL_BY_ID[btn.dataset.runProtocolInfo]; if(!p)return;
    panel.querySelector('[data-v593-info-overlay]')?.remove();
    panel.insertAdjacentHTML('beforeend',selectedProtocolInfoMarkup(p));
    const overlay=panel.querySelector('[data-v593-info-overlay]'); if(!overlay)return;
    const close=()=>overlay.remove();
    overlay.querySelector('[data-v593-info-close]')?.addEventListener('click',close);
    overlay.addEventListener('click',e=>{if(e.target===overlay)close();});
    translateDOM(overlay);
  }));
}
function paidProtocolRerollMarkup(){
  if(dailyOperationActive) return '';
  const cost=protocolRerollCost(protocolChoiceLevel||currentLevel);
  const used=protocolPaidRerollUsedLevel===protocolChoiceLevel;
  const broke=runMatter<cost;
  return `<div class="v593-reroll-bank"><button data-v593-paid-reroll ${used||broke?'disabled':''}><b>${used?T('rerollUsed'):`${T('rerollBank')} // ${cost} ✦`}</b><span>${T('rerollHint')} · ${T('runBankLabel')} ${runMatter} ✦</span></button></div>`;
}
renderProtocolChoice=function(){
  const panel=$('protocolPanel');if(!panel)return;panel.classList.add('open');
  if(!protocolChoicePending){protocolPreviewSelection='';panel.classList.remove('choosing');panel.innerHTML=awaitingNextSector?`<div class="v5-result-kicker">BUILD UPDATED</div>${selectedProtocolsMarkup()}`:'';bindSelectedProtocolInfo(panel);renderBuffHUD();return;}
  const choices=protocolChoicesForSector(protocolChoiceLevel||currentLevel);panel.classList.add('choosing');
  const tier=['','STANDARD','AMPLIFIED','OVERCHARGED','ASCENDANT','SINGULARITY'][runPowerTier()]||'STANDARD';
  panel.innerHTML=`<div class="v5-choice-head"><small>SECTOR ${String(currentLevel).padStart(3,'0')} CLEAR</small><b>${T('choose')}</b><span>${tier}</span></div><div class="v592-protocol-run-note">${T('worksRun')}</div><div class="v52-protocol-list">${choices.map(p=>{const rarity=String(p.rarity||'COMMON').toLowerCase();return `<div class="v52-proto-wrap ${rarity} ${protocolPreviewSelection===p.id?'expanded':''}"><button class="v5-protocol-card ${rarity}" data-v52-toggle="${p.id}"><span class="v5-protocol-icon">${esc(p.icon)}</span><span class="v5-protocol-copy"><small>${esc(p.rarity||'COMMON')} // ${esc(p.cat.toUpperCase())}</small><b>${esc(p.name)}</b><em>${esc(p.desc)}</em></span><i>${protocolPreviewSelection===p.id?'⌃':'⌄'}</i></button>${protocolPreviewSelection===p.id?protoDetails(p):''}</div>`;}).join('')}</div>${paidProtocolRerollMarkup()}`;
  ensureProtocolChoiceDelegation(panel);
  translateDOM(panel);
};

function ensureProtocolChoiceDelegation(panel){
  if(!panel || panel.dataset.v594Delegated==='1') return;
  panel.dataset.v594Delegated='1';
  panel.addEventListener('click',e=>{
    const toggle=e.target.closest?.('[data-v52-toggle]');
    if(toggle && panel.contains(toggle)){
      e.preventDefault();
      const id=toggle.dataset.v52Toggle;
      protocolPreviewSelection=protocolPreviewSelection===id?'':id;
      renderProtocolChoice();
      window.PolishFX?.event?.('select');
      return;
    }
    const pick=e.target.closest?.('[data-v52-pick]');
    if(pick && panel.contains(pick)){
      e.preventDefault();
      chooseProtocol(pick.dataset.v52Pick);
      return;
    }
    const paid=e.target.closest?.('[data-v593-paid-reroll]');
    if(paid && panel.contains(paid)){
      e.preventDefault();
      if(!paid.disabled) buyProtocolReroll();
    }
  });
}
const baseChooseProtocol=chooseProtocol;
chooseProtocol=function(id){baseChooseProtocol(id);setTimeout(renderBuffHUD,0);};

// -------------------------------------------------------------------------
// BUFF HUD: compact icons + stack badge. No long horizontal protocol text.
// -------------------------------------------------------------------------
function ensureBuffHUD(){let el=$('hudBuffs');if(!el){el=document.createElement('div');el.id='hudBuffs';el.className='v52-hud-buffs';$('gameHUD')?.appendChild(el);}return el;}
function renderBuffHUD(){
  const el=ensureBuffHUD();if(!el)return;const arr=PROTOCOLS.filter(p=>protocolCount(p.id)>0).sort((a,b)=>(protocolCount(b.id)-protocolCount(a.id)));const shown=arr.slice(0,8);
  el.innerHTML=shown.map(p=>`<button class="v52-buff ${String(p.rarity||'COMMON').toLowerCase()}" title="${esc(p.name)} — ${esc(p.desc)}"><span>${esc(p.icon)}</span>${protocolCount(p.id)>1?`<b>${protocolCount(p.id)}</b>`:''}</button>`).join('')+(arr.length>8?`<span class="v52-buff-more">+${arr.length-8}</span>`:'');
}
const baseLoadLevel=loadLevel;loadLevel=function(level){baseLoadLevel(level);setTimeout(()=>{renderBuffHUD();updateSectorAlert();},30);};
renderBuffHUD();

// -------------------------------------------------------------------------
// SECTOR MUTATION DRAWER: intro -> collapses to arrow -> tap to reopen.
// -------------------------------------------------------------------------
function eventTitle(e){if(!e||e.id==='none')return '';return e.name||'';}
function eventDesc(e){if(!e||e.id==='none')return '';if(e.kind==='boss'){
 const ua=['','Перший сторож RUN. Посилена столиця і турелі.','Командний вузол адаптувався: більше резерву й вогню.','WARDEN контролює сектор через небезпечні маршрути та щільну оборону.','Глибокий командний сектор: сильний production, турелі й більше hazards.','Фінальний WARDEN RUN: максимальний резерв, тиск і небезпечна арена.'];
 const ru=['','Первый страж RUN. Усиленная столица и турели.','Командный узел адаптировался: больше резерва и огня.','WARDEN контролирует сектор через опасные маршруты и плотную оборону.','Глубокий командный сектор: сильный production, турели и больше hazards.','Финальный WARDEN RUN: максимальный резерв, давление и опасная арена.'];
 const en=['','First RUN guardian. Reinforced capital and defenses.','The command node adapted: more reserves and firepower.','WARDEN controls the sector through dangerous routes and dense defenses.','Deep command sector: strong production, defenses and more hazards.','Final RUN WARDEN: maximum reserves, pressure and a dangerous arena.'];
 return (lang==='uk'?ua:lang==='ru'?ru:en)[e.bossTier||1];}
 return EVENT_TEXT[e.id]?.[idx()]||e.desc||'';
}
updateSectorAlert=function(){
  const el=$('sectorAlert');if(!el)return;if(sectorAlertTimer){clearTimeout(sectorAlertTimer);sectorAlertTimer=null;}
  const e=currentSectorEvent,bots=window.currentLevelConfig?.botCount||1,ffa=bots>=2?`FREE-FOR-ALL // ${bots+1} FACTIONS`:'';
  if((!e||e.id==='none')&&!ffa){el.className='sector-alert';el.innerHTML='';return;}
  const title=e&&e.id!=='none'?`${e.icon||'//'} ${eventTitle(e)}`:ffa;
  const desc=[e&&e.id!=='none'?eventDesc(e):'',ffa?T('ffa'):''].filter(Boolean).join(' ');
  el.className=`sector-alert v52-sector-drawer expanded ${e?.kind==='boss'?'boss':'event'}`;
  el.innerHTML=`<button class="v52-sector-arrow" aria-label="${T('mutation')}">‹</button><div class="v52-sector-body"><small>${T('mutation')}</small><b>${esc(title)}${ffa&&e&&e.id!=='none'?` // ${ffa}`:''}</b><span>${esc(desc)}</span></div>`;
  const btn=el.querySelector('.v52-sector-arrow');btn.onclick=()=>{el.classList.toggle('collapsed');el.classList.toggle('expanded');btn.textContent=el.classList.contains('collapsed')?'›':'‹';};
  sectorAlertTimer=setTimeout(()=>{el.classList.add('collapsed');el.classList.remove('expanded');if(btn)btn.textContent='›';sectorAlertTimer=null;},e?.kind==='boss'?4200:3200);
};

// -------------------------------------------------------------------------
// DEATH FLOW: three decisions on one screen. Ending goes directly to SHOP.
// -------------------------------------------------------------------------
const baseFinalizeFailedRun=finalizeFailedRun;
function openPostRunShop(total, doubled=false){
  setTimeout(()=>{
    window.__openCurrentShop?.();
    setTimeout(()=>{const panel=$('metaPanel');if(panel){const note=document.createElement('div');note.className='v52-payout-note';note.innerHTML=`<small>${T('runEnded')}</small><b>+${total} ✦${doubled?' // ×2':''}</b><span>${T('shopReady')}</span>`;panel.prepend(note);translateDOM(note);}},10);
  },0);
}
function finishFailedRun(doubleReward=false){
  if(!runAwaitingDecision)return;
  baseFinalizeFailedRun();
  doublePayoutAvailable=(lastRunPayout||0)>0; doublePayoutClaimed=false; adStatus='';
  postRunShopPending=true; saveProgress();
  showV597RunResult(false);
}
finalizeFailedRun=function(){finishFailedRun(false);};
const baseRewardContinueRunV5911=rewardContinueRun;
rewardContinueRun=function(){hideDefeatOverlay();baseRewardContinueRunV5911();};

const baseGrantAdReward=grantAdReward;
grantAdReward=function(){
  if(adBusy&&adContext==='resultDouble'){
    const bonus=lastRunPayout||0; clearAdState();
    if(doublePayoutAvailable&&!doublePayoutClaimed&&bonus>0){darkMatter+=bonus;doublePayoutClaimed=true;doublePayoutAvailable=false;adStatus=`BONUS +${bonus} ✦`;telemetryTrack('payout_double',{bonus,dm_after:darkMatter});saveProgress();try{updateShopUI();}catch(e){}try{window.PolishFX?.event('reward');}catch(e){}}
    showV597RunResult(currentLevel>=RUN_LENGTH);return;
  }
  baseGrantAdReward();
};
const baseRenderMonetization=renderMonetizationPanel;
function deathCopy(){
  return lang==='ru'
    ? {title:'ПОРАЖЕНИЕ',sub:'RUN ПРЕРВАН',end:'ЗАВЕРШИТЬ RUN'}
    : lang==='en'
      ? {title:'DEFEAT',sub:'RUN INTERRUPTED',end:'END RUN'}
      : {title:'ПОРАЗКА',sub:'RUN ПЕРЕРВАНО',end:'ЗАВЕРШИТИ RUN'};
}
function hideDefeatOverlay(){
  const ov=$('defeatOverlay');
  if(ov){ov.classList.remove('open');ov.setAttribute('aria-hidden','true');ov.innerHTML='';}
  document.body.classList.remove('defeat-open');
}
function showDefeatOverlay(){
  const ov=$('defeatOverlay');if(!ov)return;
  const payout=projectedRunPayout(),dc=deathCopy();
  ov.innerHTML=`<div class="defeat-card" role="dialog" aria-modal="true" aria-label="${esc(dc.title)}"><div class="defeat-kicker">${esc(dc.sub)}</div><h2>${esc(dc.title)}</h2><div class="defeat-sep"></div><div class="defeat-actions">${!continueUsed?`<button class="defeat-btn revive" data-defeat-action="revive" ${adBusy?'disabled':''}><b>${T('revive')}</b><span>${T('reviveSmall')}</span></button>`:''}<button class="defeat-btn end" data-defeat-action="end" ${adBusy?'disabled':''}><b>${esc(dc.end)}</b><span>+${payout} ✦</span></button></div>${adStatus?`<div class="defeat-ad-status">${esc(adStatus)}</div>`:''}</div>`;
  ov.classList.add('open');ov.setAttribute('aria-hidden','false');document.body.classList.add('defeat-open');
  ov.querySelector('[data-defeat-action="revive"]')?.addEventListener('click',()=>requestRewardedAd('continue'));
  ov.querySelector('[data-defeat-action="end"]')?.addEventListener('click',()=>{hideDefeatOverlay();finishFailedRun(false);});
  translateDOM(ov);
}
renderMonetizationPanel=function(){
  const panel=$('adPanel');if(!panel)return;
  const shop=$('shopUI');
  // RUN RESULT owns a dedicated fixed x2 dock. Never render the legacy ad panel inside the scroll.
  if(shop?.classList.contains('v598-result-mode')){
    hideDefeatOverlay();
    panel.className='ad-panel'; panel.innerHTML='';
    renderRunResultDoubleDock();
    return;
  }
  if(runAwaitingDecision){
    shop?.classList.remove('open','v598-death-mode');
    panel.className='ad-panel';panel.innerHTML='';
    const action=$('btnAction');if(action){action.style.display='none';action.disabled=true;}
    showDefeatOverlay();
    return;
  }
  hideDefeatOverlay();
  shop?.classList.remove('v598-death-mode');
  if(dailyOperationActive && protocolChoicePending){panel.innerHTML='';panel.classList.remove('open');return;}
  baseRenderMonetization();translateDOM(panel);
};
function hideSectorDrawer(){const el=$('sectorAlert');if(el&&el.classList.contains('v52-sector-drawer')){el.className='sector-alert';el.innerHTML='';}if(sectorAlertTimer){clearTimeout(sectorAlertTimer);sectorAlertTimer=null;}}
const baseOpenShop=openShop;
openShop=function(isWin){hideSectorDrawer();baseOpenShop(isWin);if(isWin&&currentLevel>=RUN_LENGTH&&!dailyOperationActive){setTimeout(()=>showV597RunResult(true),0);return;}if(!isWin&&runAwaitingDecision){const shop=$('shopUI');if(shop)shop.classList.remove('open');const b=$('btnAction');if(b){b.style.display='none';b.disabled=true;}gameState='defeat';renderMonetizationPanel();}};


// V5.9.7: robust close for selected Protocol info.
document.addEventListener('click',e=>{
  const close=e.target.closest?.('[data-v593-info-close]');
  if(!close)return;
  e.preventDefault(); e.stopPropagation();
  close.closest('[data-v593-info-overlay]')?.remove();
},true);

function runResultBuildMarkup(){
  const rows=PROTOCOLS.filter(p=>protocolCount(p.id)>0);
  if(!rows.length)return `<div class="v597-result-empty">NO PROTOCOLS</div>`;
  return `<div class="v597-result-build">${rows.map(p=>`<div class="v597-result-proto ${String(p.rarity||'COMMON').toLowerCase()}"><span>${esc(p.rarity||'COMMON')}</span><b>${esc(p.name)}</b>${protocolLevelMarks(p)}</div>`).join('')}</div>`;
}
function protocolEffectsWithoutBuild(){
  const saved=activeProtocols;
  activeProtocols={};
  let fx; try{fx=protocolEffects();}finally{activeProtocols=saved;}
  return fx;
}
function runResultEffectsMarkup(){
  const before=protocolEffectsWithoutBuild(), after=protocolEffects();
  const rows=[];
  const add=(label,a,b,fmt)=>{if(Math.abs(Number(a)-Number(b))<0.0001)return;rows.push({label,a:fmt(a),b:fmt(b)});};
  const pct=v=>`${Math.round(v*100)}%`;
  const flat=v=>{const n=Math.round(v*10)/10;return `${n>0?'+':''}${n}`;};
  add('FLEET SPEED',before.speed,after.speed,pct);
  add('PRODUCTION',before.prod,after.prod,pct);
  add('START UNITS',before.start,after.start,flat);
  add('CAPACITY BONUS',before.capacity,after.capacity,flat);
  add('CAPACITY SCALE',before.capacityFactor,after.capacityFactor,pct);
  add('SEND RATIO',before.sendRatio,after.sendRatio,pct);
  add('UNIT POWER',1+before.unitHp,1+after.unitHp,flat);
  add('ENEMY DAMAGE',before.enemyDamage,after.enemyDamage,pct);
  add('NEUTRAL DAMAGE',before.neutralDamage,after.neutralDamage,pct);
  add('BOSS DAMAGE',before.bossDamage,after.bossDamage,pct);
  add('DAMAGE TAKEN',before.armor,after.armor,pct);
  add('CAPTURE BONUS',before.captureBonus,after.captureBonus,flat);
  add('TURRET DAMAGE',before.turretDamage,after.turretDamage,flat);
  add('RUN REWARD',before.reward,after.reward,pct);
  if(!rows.length)return `<div class="v598-effects-empty">BUILD DID NOT CHANGE BASE STATS</div>`;
  return `<div class="v598-effects"><div class="v598-effects-head"><span>CHARACTERISTIC</span><span>BEFORE</span><span>AFTER</span></div>${rows.map(r=>`<div><b>${r.label}</b><span>${r.a}</span><strong>${r.b}</strong></div>`).join('')}</div>`;
}
function resultCopy(completed){
  if(lang==='ru')return {title:completed?'RUN ЗАВЕРШЁН':'РЕЗУЛЬТАТ RUN',summary:'ИТОГ ЗАБЕГА',build:'ПРОТОКОЛЫ',effects:'ХАРАКТЕРИСТИКИ // ДО → ПОСЛЕ',captured:'ЗАХВАЧЕНО',reward:'DARK MATTER',revive:'ВОССТАНОВЛЕНИЕ',yes:'ИСПОЛЬЗОВАНО',no:'НЕТ',continue:'ПРОДОЛЖИТЬ',double:'×2 DARK MATTER',claimed:'×2 ПОЛУЧЕНО'};
  if(lang==='en')return {title:completed?'RUN COMPLETE':'RUN RESULT',summary:'RUN SUMMARY',build:'PROTOCOLS',effects:'STATS // BEFORE → AFTER',captured:'CAPTURED',reward:'DARK MATTER',revive:'REVIVE',yes:'USED',no:'NO',continue:'CONTINUE',double:'×2 DARK MATTER',claimed:'×2 CLAIMED'};
  return {title:completed?'RUN ЗАВЕРШЕНО':'РЕЗУЛЬТАТ RUN',summary:'ПІДСУМОК ЗАБІГУ',build:'ПРОТОКОЛИ',effects:'ХАРАКТЕРИСТИКИ // ДО → ПІСЛЯ',captured:'ЗАХОПЛЕНО',reward:'DARK MATTER',revive:'ВІДНОВЛЕННЯ',yes:'ВИКОРИСТАНО',no:'НІ',continue:'ПРОДОВЖИТИ',double:'×2 DARK MATTER',claimed:'×2 ОТРИМАНО'};
}
function runResultDoubleSub(){
  if(lang==='ru')return 'Посмотри рекламу — удвой заработанную Тёмную Материю.';
  if(lang==='en')return 'Watch an ad — double the Dark Matter earned this RUN.';
  return 'Переглянь рекламу — подвой зароблену Темну Матерію.';
}
function renderRunResultDoubleDock(){
  const btn=$('btnRunResultDouble'), shop=$('shopUI'), footer=shop?.querySelector?.('.shop-footer');
  if(!btn)return;
  const onResult=!!shop?.classList.contains('v598-result-mode');
  btn.setAttribute('aria-hidden',onResult?'false':'true');
  if(footer){
    if(onResult){
      footer.style.setProperty('display','flex','important');
      footer.style.setProperty('flex-direction','column','important');
      footer.style.setProperty('justify-content','flex-end','important');
      footer.style.setProperty('align-items','center','important');
      footer.style.setProperty('gap','7px','important');
      footer.style.setProperty('padding','8px 12px max(10px,env(safe-area-inset-bottom))','important');
      footer.style.setProperty('background','linear-gradient(transparent,rgba(2,5,8,.99) 16%)','important');
      footer.style.setProperty('z-index','40','important');
    } else {
      footer.style.removeProperty('flex-direction');
      footer.style.removeProperty('justify-content');
      footer.style.removeProperty('align-items');
      footer.style.removeProperty('gap');
      footer.style.removeProperty('padding');
      footer.style.removeProperty('background');
      footer.style.removeProperty('z-index');
    }
  }
  if(!onResult){
    btn.disabled=true;btn.onclick=null;btn.classList.remove('claimed');
    btn.style.setProperty('display','none','important');
    return;
  }
  btn.style.setProperty('display','flex','important');
  btn.style.setProperty('width','min(100%,488px)','important');
  btn.style.setProperty('min-height','72px','important');
  btn.style.setProperty('margin','0 auto','important');
  btn.style.setProperty('padding','12px 14px','important');
  btn.style.setProperty('box-sizing','border-box','important');
  btn.style.setProperty('visibility','visible','important');
  btn.style.setProperty('opacity','1','important');
  btn.style.setProperty('align-items','flex-start','important');
  btn.style.setProperty('justify-content','center','important');
  btn.style.setProperty('flex-direction','column','important');
  btn.style.setProperty('gap','6px','important');
  btn.style.setProperty('border','2px solid rgba(255,255,255,.92)','important');
  btn.style.setProperty('background','linear-gradient(180deg,rgba(255,255,255,.11),rgba(255,255,255,.035) 48%,rgba(255,255,255,.07))','important');
  btn.style.setProperty('color','#fff','important');
  btn.style.setProperty('box-shadow','0 0 0 1px rgba(255,255,255,.10) inset,0 0 18px rgba(255,255,255,.08)','important');
  btn.style.setProperty('appearance','none','important');
  btn.style.setProperty('-webkit-appearance','none','important');
  btn.style.setProperty('border-radius','0','important');
  const payout=lastRunPayout||0, completed=shop.dataset.resultComplete==='1', rc=resultCopy(completed);
  const canDouble=doublePayoutAvailable&&!doublePayoutClaimed&&payout>0;
  btn.classList.toggle('claimed',!!doublePayoutClaimed);
  btn.disabled=!!adBusy||!canDouble;
  btn.innerHTML=`<b>✦ ${doublePayoutClaimed?rc.claimed:rc.double}</b><span>${doublePayoutClaimed?`TOTAL ${payout*2} ✦`:`${payout} ✦ → ${payout*2} ✦`}</span>${doublePayoutClaimed?'':`<small>${runResultDoubleSub()}</small>`}`;
  btn.onclick=canDouble&&!adBusy?()=>requestRewardedAd('resultDouble'):null;
  translateDOM(btn);
}

function showV597RunResult(completed=false){
  hideDefeatOverlay();
  gameState='shop';
  const shop=$('shopUI'); if(shop){shop.classList.add('open');shop.classList.remove('v598-death-mode');shop.classList.add('v598-result-mode');shop.dataset.resultComplete=completed?'1':'0';}
  const payout=lastRunPayout||0, reached=completed?RUN_LENGTH:currentLevel,rc=resultCopy(completed);
  setShopMode('end'); clearMenuPanels();
  if($('shopTitle'))$('shopTitle').textContent=rc.title;
  if($('shopSubtitle'))$('shopSubtitle').textContent=completed?'40 / 40 // ALL 5 ACTS CLEARED':`S${String(reached).padStart(3,'0')}`;
  if($('runStats'))$('runStats').innerHTML=`<section class="v597-result-card v598-result-card ${completed?'complete':''}">
    <div class="v597-result-head"><small>${rc.summary}</small><b>${completed?'40 / 40':`S${String(reached).padStart(3,'0')}`}</b></div>
    <div class="v597-result-stats"><div><small>${rc.captured}</small><b>${runCaptured}</b></div><div><small>${rc.reward}</small><b>${payout} ✦</b></div><div><small>${rc.revive}</small><b>${continueUsed?rc.yes:rc.no}</b></div></div>
    ${completed&&lastThreatUnlock?`<div class="v5922-core-unlock-banner"><small>CORE CHAMBER</small><b>${coreLabel(lastThreatUnlock)} UNLOCKED</b><span>40/40 CLEAR // NEW DIFFICULTY ONLINE</span></div>`:''}
    <div class="v598-result-section"><small class="v597-result-label">${rc.effects}</small>${runResultEffectsMarkup()}</div>
    <div class="v598-result-section"><small class="v597-result-label">${rc.build}</small>${runResultBuildMarkup()}</div>
  </section>`;
  renderProtocolChoice(); renderRetentionPanel(false); renderMetaPanel(false); renderCosmeticsPanel?.(false);
  const ad=$('adPanel'); if(ad){ad.className='ad-panel';ad.innerHTML='';}
  renderRunResultDoubleDock();
  const action=$('btnAction'); if(action){action.style.display='block';action.disabled=false;action.textContent=rc.continue;action.dataset.runResultAction='1';action.style.setProperty('width','min(100%,488px)','important');action.style.setProperty('margin','0 auto','important');}
  translateDOM($('shopUI'));
  // Legacy end-of-run code may repaint the footer after this function; reassert the result CTA.
  requestAnimationFrame(()=>{if($('shopUI')?.classList.contains('v598-result-mode')){const a=$('btnAction');if(a)a.textContent=resultCopy($('shopUI').dataset.resultComplete==='1').continue;}});
}

// V5.9.10: keep the original stable footer CTA on RUN RESULT.
document.addEventListener('click',e=>{
  const action=e.target.closest?.('#btnAction');
  const shop=$('shopUI');
  if(!action||!shop?.classList.contains('v598-result-mode'))return;
  e.preventDefault();e.stopImmediatePropagation();
  shop.classList.remove('v598-result-mode');delete shop.dataset.resultComplete;
  action.removeAttribute('data-run-result-action');
  const ad=$('adPanel');if(ad){ad.className='ad-panel';ad.innerHTML='';}
  const dbl=$('btnRunResultDouble');if(dbl){dbl.setAttribute('aria-hidden','true');dbl.disabled=true;dbl.onclick=null;dbl.classList.remove('claimed');dbl.style.setProperty('display','none','important');}
  const footer=shop?.querySelector?.('.shop-footer');
  if(footer){footer.style.removeProperty('flex-direction');footer.style.removeProperty('justify-content');footer.style.removeProperty('align-items');footer.style.removeProperty('gap');footer.style.removeProperty('padding');footer.style.removeProperty('background');footer.style.removeProperty('z-index');}
  postRunShopPending=true;prepareFreshRun();runEnded=false;postRunShopPending=true;saveProgress();window.__openCurrentShop?.();
},true);

// Keep the RUN RESULT footer label stable even if legacy code repaints btnAction.
const resultFooterObserver=new MutationObserver(()=>{
  const shop=$('shopUI'),action=$('btnAction');
  if(!shop?.classList.contains('v598-result-mode')||!action)return;
  const wanted=resultCopy(shop.dataset.resultComplete==='1').continue;
  if(action.textContent!==wanted)action.textContent=wanted;
});
if($('btnAction'))resultFooterObserver.observe($('btnAction'),{childList:true,characterData:true,subtree:true});

// -------------------------------------------------------------------------
// Localization helpers for sector / onboarding / dynamic UI.
// -------------------------------------------------------------------------
function patchOnboardingNow(){
  const title=$('onboardingTitle'),text=$('onboardingText');if(!title||!text)return;
  const raw=title.textContent;
  const step=/^[123]\./.test(raw)?Number(raw[0]):1;
  const keys=step===1?['first','firstText']:step===2?['second','secondText']:['third','thirdText'];const nt=T(keys[0]),nx=T(keys[1]);if(title.textContent!==nt)title.textContent=nt;if(text.textContent!==nx)text.textContent=nx;
  const next=$('btnOnboardingNext');if(next){const dots=$('onboardingDots');const active=[...(dots?.children||[])].findIndex(x=>x.classList.contains('active'));const nv=active>=2?T('deploy'):T('next');if(next.textContent!==nv)next.textContent=nv;}
  const sk=$('btnOnboardingSkip');if(sk&&sk.textContent!==T('skip'))sk.textContent=T('skip');
}
const obObs=new MutationObserver(()=>patchOnboardingNow());if($('onboardingOverlay'))obObs.observe($('onboardingOverlay'),{subtree:true,childList:true,characterData:true});
patchOnboardingNow();

// Repaint after the legacy/UI boot timers.
setTimeout(()=>{ensureLangBars();applyDataLanguage();renderBuffHUD();translateDOM();if(runAwaitingDecision){gameState='defeat';$('shopUI')?.classList.remove('open');renderMonetizationPanel();}else if(gameState==='playing')updateSectorAlert();else if(gameState==='shop')window.__repaintCurrentUI?.();},80);
})();


// V5.4.2 authoritative startup: current UI is installed before state restoration.
window.__bootGameStateCore?.();
setTimeout(()=>window.__repaintCurrentUI?.(),0);
