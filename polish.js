// 1-Bit Sector V5.3 — SFX-only polish, onboarding, pause/settings, PlayDeck polish
(() => {
  'use strict';

  const STORAGE_KEY = '1BitPolish';
  const isUk = ((navigator.languages && navigator.languages[0]) || navigator.language || 'en').toLowerCase().startsWith('uk');
  const copy = isUk ? {
    next:'ДАЛІ >>', done:'В БІЙ >>', skip:'ПРОПУСТИТИ',
    steps:[
      {title:'1. ТВОЯ МЕРЕЖА', text:'Трикутник ▲ — твоя база. Коло ○ — нейтральний вузол. Ромб ◇ — ворог.', visual:'owners'},
      {title:'2. ВІДПРАВ ФЛОТ', text:'TAP по своїй базі → TAP по цілі. Або затисни й протягни від бази до цілі.', visual:'send'},
      {title:'3. ЗАХОПИ СЕКТОР', text:'Забери всі ворожі вузли. Після перемоги обери Protocol — він працює до кінця RUN.', visual:'goal'}
    ]
  } : {
    next:'NEXT >>', done:'DEPLOY >>', skip:'SKIP',
    steps:[
      {title:'1. YOUR NETWORK', text:'Triangle ▲ is your base. Circle ○ is neutral. Diamond ◇ is hostile.', visual:'owners'},
      {title:'2. SEND A FLEET', text:'TAP your base → TAP a target. Or drag from your base directly to the target.', visual:'send'},
      {title:'3. CLEAR THE SECTOR', text:'Capture every hostile node. After a win, pick one Protocol for the rest of the RUN.', visual:'goal'}
    ]
  };

  let settings = { onboardingSeen:false, sound:true, sfx:true, haptics:true, shake:true, sfxVolume:.95 };
  try { settings = {...settings, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')}; } catch(e){}
  const onboardingSeenOnBoot = !!settings.onboardingSeen;
  let forceAutoDeployAfterOnboarding = false;
  if(settings.sound===false) settings.sfx=false;
  if(settings.sfx===undefined) settings.sfx=true;
  settings.sfxVolume=Math.max(0,Math.min(1,Number(settings.sfxVolume ?? .95)));
  // V4.3 intentionally ships without background music.
  delete settings.music; delete settings.musicVolume; delete settings.ostVersion;
  window.GameFeedbackSettings=settings;
  const persist = () => { try { settings.sound=!!settings.sfx; localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); window.GameFeedbackSettings=settings; } catch(e){} };

  // --- Lightweight generated audio. No external assets. ---
  let ac = null;
  function audioContext(){
    if(!settings.sfx) return null;
    try {
      if(!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
      if(ac.state === 'suspended') ac.resume().catch(()=>{});
      return ac;
    } catch(e){ return null; }
  }
  function tone(freq=440, duration=.055, gain=.025, type='square', slide=0){
    if(!settings.sfx) return;
    const a=audioContext(); if(!a) return;
    gain *= Math.max(.02,settings.sfxVolume);
    const now=a.currentTime, o=a.createOscillator(), g=a.createGain();
    o.type=type; o.frequency.setValueAtTime(freq,now);
    if(slide) o.frequency.exponentialRampToValueAtTime(Math.max(35,freq+slide),now+duration);
    g.gain.setValueAtTime(.0001,now); g.gain.exponentialRampToValueAtTime(Math.max(.0002,gain),now+.006); g.gain.exponentialRampToValueAtTime(.0001,now+duration);
    o.connect(g); g.connect(a.destination); o.start(now); o.stop(now+duration+.02);
  }
  function sound(name){
    if(!settings.sfx) return;
    if(name==='select') tone(760,.04,.035,'square',80);
    else if(name==='send'){ tone(330,.06,.040,'square',180); setTimeout(()=>tone(520,.045,.026,'square',80),38); }
    else if(name==='capture'){ tone(520,.055,.040,'square',160); setTimeout(()=>tone(820,.07,.030,'triangle',100),45); }
    else if(name==='protocol'){ tone(430,.05,.02,'triangle',250); setTimeout(()=>tone(860,.07,.018,'triangle',120),55); }
    else if(name==='win'){ tone(390,.07,.022,'triangle',180); setTimeout(()=>tone(620,.08,.022,'triangle',220),70); setTimeout(()=>tone(930,.10,.018,'triangle',100),145); }
    else if(name==='lose'){ tone(190,.12,.026,'sawtooth',-90); setTimeout(()=>tone(110,.15,.018,'square',-35),90); }
    else if(name==='boss') { tone(120,.16,.03,'sawtooth',-30); setTimeout(()=>tone(180,.10,.018,'square',40),120); }
    else if(name==='unlock'){ tone(650,.06,.02,'triangle',180); setTimeout(()=>tone(1040,.09,.018,'triangle',120),60); }
    else if(name==='reward'){ tone(880,.045,.02,'square',160); setTimeout(()=>tone(1180,.06,.015,'triangle',100),45); }
    else if(name==='act'){ tone(160,.10,.026,'sawtooth',80); setTimeout(()=>tone(440,.12,.02,'triangle',260),95); }
    else if(name==='enemySend'){ tone(250,.065,.038,'square',40); setTimeout(()=>tone(185,.055,.028,'square',-20),38); }
    else if(name==='enemyCapture'){ tone(180,.10,.045,'sawtooth',-25); setTimeout(()=>tone(125,.09,.035,'square',-18),55); }
    else if(name==='wormhole'){ tone(420,.08,.032,'triangle',260); setTimeout(()=>tone(760,.07,.025,'triangle',-140),35); }
    else if(name==='blackhole'){ tone(150,.13,.035,'sawtooth',-80); setTimeout(()=>tone(90,.15,.026,'sine',-25),70); }
    else if(name==='anomaly'){ tone(520,.09,.034,'triangle',90); setTimeout(()=>tone(690,.09,.028,'sine',-50),40); }
    else if(name==='error') tone(130,.08,.018,'square',-35);
  }



  function haptic(name){
    if(!settings.haptics) return;
    const parentWin = window.parent;
    let value = {type:'selectionChanged'};
    if(name==='send' || name==='select') value={type:'impactOccurred',style:'light'};
    else if(name==='capture' || name==='protocol' || name==='reward') value={type:'impactOccurred',style:'medium'};
    else if(name==='boss' || name==='act') value={type:'impactOccurred',style:'heavy'};
    else if(name==='win' || name==='unlock') value={type:'notificationOccurred',notificationType:'success'};
    else if(name==='lose' || name==='error') value={type:'notificationOccurred',notificationType:'error'};
    try { if(parentWin !== window) parentWin.postMessage({playdeck:{method:'hapticFeedback',value}},'*');
      else if(navigator.vibrate) navigator.vibrate(name==='win'?[20,35,40]:(name==='lose'?[60,35,90]:18));
    } catch(e){}
  }

  let lastEventAt = {};
  function event(name){
    const now=performance.now();
    if(lastEventAt[name] && now-lastEventAt[name] < (name==='capture'?90:45)) return;
    lastEventAt[name]=now; sound(name); haptic(name);
    if(['capture','win','unlock','reward'].includes(name)) {
      document.body.classList.remove('feedback-flash'); void document.body.offsetWidth; document.body.classList.add('feedback-flash');
      setTimeout(()=>document.body.classList.remove('feedback-flash'),260);
    }
  }
  window.PolishFX = { event, sound, haptic };
  document.addEventListener('pointerdown',()=>{ audioContext(); },{once:true,passive:true});

  // --- Controls ---
  const snd=document.getElementById('btnSoundToggle'), hpt=document.getElementById('btnHapticToggle');
  function renderControls(){
    if(snd){snd.textContent=settings.sfx?'SFX':'SFX×';snd.classList.toggle('off',!settings.sfx);}
    if(hpt){hpt.textContent=settings.haptics?'HPT':'HPT×';hpt.classList.toggle('off',!settings.haptics);}
  }
  snd?.addEventListener('click',()=>{ settings.sfx=!settings.sfx; persist(); renderControls(); if(settings.sfx) event('select'); });
  hpt?.addEventListener('click',()=>{ settings.haptics=!settings.haptics; persist(); renderControls(); if(settings.haptics) haptic('select'); });
  renderControls();

  // Keep feedback toggles away from the primary bottom CTA while menu panels are open.
  const shopUI=document.getElementById('shopUI');
  const syncMenuClass=()=>document.body.classList.toggle('menu-open',!!shopUI?.classList.contains('open'));
  if(shopUI){ new MutationObserver(syncMenuClass).observe(shopUI,{attributes:true,attributeFilter:['class']}); syncMenuClass(); }

  // --- V3.7 pause/settings panel ---
  const pauseOverlay=document.getElementById('pauseOverlay');
  const pauseBtn=document.getElementById('btnPauseGame');
  const resumeBtn=document.getElementById('btnResumeGame');
  const sfxBtn=document.getElementById('btnPauseSfx');
  const shakeBtn=document.getElementById('btnPauseShake');
  const pauseHapticBtn=document.getElementById('btnPauseHaptic');
  const sfxVol=document.getElementById('sfxVolume');
  const endRunBtn=document.getElementById('btnPauseEndRun');
  const endConfirm=document.getElementById('pauseEndConfirm');
  const endCancelBtn=document.getElementById('btnPauseEndCancel');
  const endConfirmBtn=document.getElementById('btnPauseEndConfirm');
  let prePauseState='playing';
  function pauseRender(){
    if(sfxBtn){sfxBtn.textContent=settings.sfx?'ON':'OFF';sfxBtn.classList.toggle('off',!settings.sfx);}
    if(shakeBtn){shakeBtn.textContent=`SHAKE // ${settings.shake?'ON':'OFF'}`;shakeBtn.classList.toggle('off',!settings.shake);}
    if(pauseHapticBtn){pauseHapticBtn.textContent=`HAPTIC // ${settings.haptics?'ON':'OFF'}`;pauseHapticBtn.classList.toggle('off',!settings.haptics);}
    if(sfxVol)sfxVol.value=Math.round(settings.sfxVolume*100);
  }
  function openPause(){
    if(!pauseOverlay||gameState!=='playing')return;
    endConfirm?.classList.remove('open'); endConfirm?.setAttribute('aria-hidden','true');
    prePauseState=gameState;gameState='paused';
    pauseOverlay.classList.add('open');pauseOverlay.setAttribute('aria-hidden','false');document.body.classList.add('game-paused');
    pauseRender();if(!document.hidden)event('select');
  }
  function closePause(){
    if(!pauseOverlay?.classList.contains('open'))return;
    endConfirm?.classList.remove('open'); endConfirm?.setAttribute('aria-hidden','true');
    pauseOverlay.classList.remove('open');pauseOverlay.setAttribute('aria-hidden','true');document.body.classList.remove('game-paused');
    gameState=prePauseState==='playing'?'playing':prePauseState;persist();event('select');
  }
  pauseBtn?.addEventListener('click',openPause);
  resumeBtn?.addEventListener('click',closePause);
  pauseOverlay?.addEventListener('pointerdown',e=>{if(e.target===pauseOverlay)closePause();});
  sfxBtn?.addEventListener('click',()=>{settings.sfx=!settings.sfx;persist();pauseRender();if(settings.sfx)event('select');});
  shakeBtn?.addEventListener('click',()=>{settings.shake=!settings.shake;persist();pauseRender();});
  pauseHapticBtn?.addEventListener('click',()=>{settings.haptics=!settings.haptics;persist();pauseRender();if(settings.haptics)haptic('select');});
  sfxVol?.addEventListener('input',()=>{settings.sfxVolume=Number(sfxVol.value)/100;persist();if(settings.sfx)tone(620,.035,.022,'square',80);});
  endRunBtn?.addEventListener('click',()=>{
    endConfirm?.classList.add('open'); endConfirm?.setAttribute('aria-hidden','false');
    event('select');
  });
  endCancelBtn?.addEventListener('click',()=>{
    endConfirm?.classList.remove('open'); endConfirm?.setAttribute('aria-hidden','true');
    event('select');
  });
  endConfirmBtn?.addEventListener('click',()=>{
    const wasDaily=!!window.dailyOperationActive || (typeof dailyOperationActive!=='undefined' && dailyOperationActive);
    endConfirmBtn.disabled=true;
    closePause();
    try{ window.GameTelemetry?.track?.('run_surrender',{sector:typeof currentLevel!=='undefined'?currentLevel:0,daily:wasDaily}); }catch(e){}
    try{
      if(wasDaily && typeof finishDailyOperation==='function'){ finishDailyOperation(false); return; }
      if(typeof runAwaitingDecision!=='undefined') runAwaitingDecision=true;
      if(typeof runEnded!=='undefined') runEnded=false;
      if(typeof runStarted!=='undefined') runStarted=true;
      if(typeof adStatus!=='undefined') adStatus='';
      if(typeof finalizeFailedRun==='function') finalizeFailedRun();
    }finally{ setTimeout(()=>{endConfirmBtn.disabled=false;},250); }
  });
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){pauseOverlay?.classList.contains('open')?closePause():openPause();}});
  pauseRender();

  // --- 3-screen onboarding, shown once. ---
  const ob=document.getElementById('onboardingOverlay');
  let obIndex=0;
  function visualMarkup(kind){
    if(kind==='owners') return '<div class="you"><span>▲</span></div><div class="target">0</div><div class="enemy"><span>◇</span></div>';
    if(kind==='send') return '<div class="you"><span>▲</span></div><div style="position:relative;z-index:2;font-size:14px">→→→</div><div class="target">?</div>';
    return '<div class="you"><span>▲</span></div><div style="position:relative;z-index:2;font-size:12px">CAPTURE</div><div class="enemy"><span>◇</span></div>';
  }
  function renderOnboarding(){
    const st=copy.steps[obIndex];
    document.getElementById('onboardingTitle').textContent=st.title;
    document.getElementById('onboardingText').textContent=st.text;
    document.getElementById('onboardingVisual').innerHTML=visualMarkup(st.visual);
    document.getElementById('onboardingDots').innerHTML=copy.steps.map((_,i)=>`<i class="${i===obIndex?'active':''}"></i>`).join('');
    const next=document.getElementById('btnOnboardingNext'); next.textContent=obIndex===copy.steps.length-1?copy.done:copy.next;
    document.getElementById('btnOnboardingSkip').textContent=copy.skip;
  }
  function closeOnboarding(reason='complete'){
    const shouldDeploy=(!onboardingSeenOnBoot || forceAutoDeployAfterOnboarding) && typeof runStarted!=='undefined' && !runStarted;
    window.GameTelemetry?.track?.(reason==='skip'?'onboarding_skip':'onboarding_complete',{step:obIndex+1});
    settings.onboardingSeen=true; persist(); ob?.classList.remove('open'); ob?.setAttribute('aria-hidden','true'); document.body.classList.remove('onboarding-active'); event('select');
    forceAutoDeployAfterOnboarding=false;
    if(shouldDeploy) setTimeout(()=>{ try{ document.getElementById('shopUI')?.classList.remove('open'); startNewRun(); }catch(e){ console.error('Auto deploy failed',e); } },120);
  }
  function openOnboarding(){ if(!ob) return; obIndex=0; window.GameTelemetry?.track?.('onboarding_start',{}); renderOnboarding(); document.body.classList.add('onboarding-active'); ob.classList.add('open'); ob.setAttribute('aria-hidden','false'); }
  window.resetPolishExperience=()=>{settings.onboardingSeen=false;forceAutoDeployAfterOnboarding=true;persist();setTimeout(openOnboarding,60);};
  document.getElementById('btnOnboardingNext')?.addEventListener('click',()=>{ event('select'); if(obIndex<copy.steps.length-1){obIndex++;renderOnboarding();}else closeOnboarding('complete'); });
  document.getElementById('btnOnboardingSkip')?.addEventListener('click',()=>closeOnboarding('skip'));
  if(!settings.onboardingSeen) setTimeout(openOnboarding,260);

  // --- ACT escalation overlay ---
  let lastLevel = (typeof currentLevel!=='undefined') ? currentLevel : 1;
  let lastGameState = (typeof gameState!=='undefined') ? gameState : '';
  let lastSectorEventKey = '';
  let lastNodeOwners = new WeakMap();
  const shownActs=new Set();
  function showAct(level){
    const starts={9:2,17:3,25:4,33:5};
    const act=starts[level]||0; if(!act) return;
    const key=`${typeof runNumber!=='undefined'?runNumber:0}:${act}`; if(shownActs.has(key)) return; shownActs.add(key);
    const el=document.getElementById('actTransition'); if(!el) return;
    const roman=['','I','II','III','IV','V'][act];
    const copy={
      2:'AMPLIFIED PROTOCOLS // OUTPOST SIGNALS ONLINE',
      3:'OVERCHARGED BUILD // STARTING TERRITORY ACTIVE',
      4:'ASCENDANT BUILD // DOUBLE OUTPOSTS POSSIBLE',
      5:'SINGULARITY BUILD // MAXIMUM RUN PRESSURE'
    };
    document.getElementById('actTransitionTitle').textContent=`ACT ${roman}`;
    document.getElementById('actTransitionText').textContent=copy[act]||'PRESSURE UP';
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); el.setAttribute('aria-hidden','false'); event('act');
    setTimeout(()=>{el.classList.remove('show');el.setAttribute('aria-hidden','true');},1580);
  }
  function monitor(){
    try {
      if(gameState==='playing' && (currentLevel!==lastLevel || lastGameState!=='playing')) showAct(currentLevel);
      const evKey = currentSectorEvent ? `${currentSectorEvent.kind}:${currentSectorEvent.name||currentSectorEvent.title||''}:${currentLevel}` : '';
      if(evKey && evKey !== lastSectorEventKey && currentSectorEvent?.kind==='event') event('anomaly');
      lastSectorEventKey = evKey;
      if(Array.isArray(nodes)){
        for(let i=0;i<nodes.length;i++){
          const n=nodes[i],prev=lastNodeOwners.get(n);
          if(prev!==undefined && prev!==n.owner && n.owner>1) event('enemyCapture');
          lastNodeOwners.set(n,n.owner);
        }
      }
      lastLevel=currentLevel; lastGameState=gameState;
    } catch(e){}
  }
  // This is state monitoring, not rendering: a timer avoids an extra RAF callback every frame.
  setInterval(monitor,200);
  monitor();

  // --- Hook high-value game moments without changing the simulation. ---
  try {
    const oldSend=sendFleet;
    sendFleet=function(startNodes,target){
      const before=(startNodes||[]).reduce((a,n)=>a+(n?.unitsCount||0),0);
      const owner=(startNodes&&startNodes[0]&&startNodes[0].owner)||0;
      oldSend(startNodes,target);
      const after=(startNodes||[]).reduce((a,n)=>a+(n?.unitsCount||0),0);
      if(after<before) event(owner===1?'send':'enemySend');
    };
  } catch(e){}
  try {
    const oldProtocol=chooseProtocol;
    chooseProtocol=function(id){ const before=(activeProtocols?.[id]||0); oldProtocol(id); if((activeProtocols?.[id]||0)>before) event('protocol'); };
  } catch(e){}
  try {
    const oldMeta=buyMetaUnlock;
    buyMetaUnlock=function(id){ const before=!!metaUnlocks?.[id]; oldMeta(id); if(!before && metaUnlocks?.[id]) event('unlock'); };
  } catch(e){}
  try {
    const oldOpen=openShop;
    openShop=function(isWin){ oldOpen(isWin); event(isWin?'win':'lose'); };
  } catch(e){}
  try {
    const oldGrant=grantAdReward;
    grantAdReward=function(){ const wasBusy=adBusy; oldGrant(); if(wasBusy) event('reward'); };
  } catch(e){}

  // Tap selection feedback (the pointer listener in main.js is already bound before this script loads).
  try {
    canvas.addEventListener('pointerdown',(e)=>{
      if(gameState!=='playing') return;
      const n=nodes.find(n=>Math.hypot(n.x-e.clientX,n.y-e.clientY)<n.radius+10);
      if(n && n.owner===1) event('select');
    },{passive:true});
  } catch(e){}

  // --- PlayDeck cloud sync + locale request. ---
  const pdParent=window.parent;
  function compareSaveProgress(a,b){
    if(!a&& !b) return 0; if(a&&!b) return 1; if(!a&&b) return -1;
    const keys=[
      d=>Number(d.completedRuns)||0,
      d=>Number(d.maxThreatUnlocked)||0,
      d=>Number(d.lifetimeSectors)||0,
      d=>Number(d.totalRuns)||0,
      d=>Number(d.bestSector)||0,
      d=>Number(d.lifetimeCaptured)||0,
      d=>Object.values(d.metaUnlocks||{}).filter(Boolean).length,
      d=>Object.values(d.achievementUnlocks||{}).filter(Boolean).length,
      d=>Number(d.dm)||0,
      d=>Number(d.savedAt)||0
    ];
    for(const pick of keys){ const av=pick(a),bv=pick(b); if(av>bv)return 1;if(av<bv)return -1; }
    return 0;
  }
  function markCloudReady(status='ready'){ window.__playdeckCloudReady=true; window.__playdeckCloudStatus=status; }
  window.addEventListener('message',({data})=>{
    const pd=data?.playdeck; if(!pd) return;
    if(pd.method==='startAd'){ try{ac?.suspend();}catch(e){} }
    if(pd.method==='rewardedAd'||pd.method==='errAd'||pd.method==='skipAd'||pd.method==='notFoundAd'){ if(settings.sfx){ try{ac?.resume();}catch(e){} } }
    if(pd.method==='getUserProfile'){
      try { const loc=pd.value?.locale; if(loc) document.documentElement.dataset.playdeckLocale=loc; } catch(e){}
    }
    if(pd.method==='getData' && pd.key==='playerSave'){
      try {
        const localRaw=localStorage.getItem('1BitSave'); const local=localRaw?JSON.parse(localRaw):null;
        const hasCloud=typeof pd.value==='string' && pd.value.length>0;
        const cloud=hasCloud?JSON.parse(pd.value):null;
        const cmp=compareSaveProgress(cloud,local);
        if(hasCloud && cmp>0 && sessionStorage.getItem('1bitCloudApplied')!=='1'){
          localStorage.setItem('1BitSave',pd.value); sessionStorage.setItem('1bitCloudApplied','1');
          window.__playdeckCloudStatus='cloud_newer'; location.reload();
        } else {
          markCloudReady(hasCloud?'synced':'empty_cloud');
          if(localRaw && cmp<=0){ pdParent.postMessage({playdeck:{method:'setData',key:'playerSave',value:localRaw}},'*'); }
        }
      } catch(e){ markCloudReady('cloud_error'); }
    }
  });
  if(pdParent!==window){
    try { pdParent.postMessage({playdeck:{method:'getData',key:'playerSave'}},'*'); } catch(e){}
    try { pdParent.postMessage({playdeck:{method:'getUserProfile'}},'*'); } catch(e){}
  }

  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){
      try{ac?.suspend();}catch(e){}
      if(gameState==='playing') openPause();
    } else if(settings.sfx){ try{ac?.resume();}catch(e){} }
  });

})();

