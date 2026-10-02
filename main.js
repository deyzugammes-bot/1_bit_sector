const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const __perfUA = navigator.userAgent || '';
const __perfLite = window.matchMedia?.('(max-width: 700px)')?.matches || /Firefox|Telegram|; wv\)/i.test(__perfUA) || ((navigator.hardwareConcurrency||8) <= 4);
window.__PERF_LITE__ = !!__perfLite;
document.documentElement.classList.toggle('perf-lite', !!__perfLite);
let __gameDprCap = __perfLite ? 1.5 : 2;
let __lastCanvasW = 0, __lastCanvasH = 0, __resizeTimer = 0;
function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, __gameDprCap);
    const W = window.innerWidth;
    const H = window.innerHeight;
    __lastCanvasW=W; __lastCanvasH=H;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
resizeCanvas();
// Telegram/Android browser chrome can fire many resize events while its toolbar changes height.
// Ignore small height-only changes and debounce real viewport/orientation changes.
window.addEventListener('resize', () => {
    clearTimeout(__resizeTimer);
    __resizeTimer=setTimeout(()=>{
        const W=window.innerWidth,H=window.innerHeight;
        if(W===__lastCanvasW && Math.abs(H-__lastCanvasH)<180) return;
        resizeCanvas();
        try{ initStars(); }catch(e){}
    },140);
});
let __adaptiveFrames=0, __adaptiveStart=performance.now(), __adaptiveSlow=0;
function adaptivePerfTick(now){
    if(!__perfLite) return;
    __adaptiveFrames++;
    const span=now-__adaptiveStart;
    if(span<2500) return;
    const fps=__adaptiveFrames*1000/span;
    __adaptiveFrames=0; __adaptiveStart=now;
    if(fps<42) __adaptiveSlow++; else __adaptiveSlow=0;
    if(__adaptiveSlow>=2 && __gameDprCap>1.25){
        __gameDprCap=1.25; __adaptiveSlow=0; resizeCanvas();
        document.documentElement.classList.add('perf-degraded');
    }
}
let __framePE=null;

const pdParent = window.parent;
let playdeckPlatform='unknown';
let playdeckOverlayOpen=false;
window.__playdeckCloudReady = (pdParent===window);
window.__playdeckCloudStatus = pdParent===window ? 'local' : 'pending';
function requestPlayDeckState(){
    if(pdParent===window) return;
    try{ pdParent.postMessage({playdeck:{method:'getPlaydeckState'}},'*'); }catch(e){}
}
function notifyPlayDeckGameEnd(reason='run_end'){
    if(pdParent===window) return;
    try{ pdParent.postMessage({playdeck:{method:'gameEnd'}},'*'); }catch(e){}
    try{ telemetryTrack('playdeck_game_end',{reason}); }catch(e){}
}
function reportPlayDeckAchievement(name,description='',points=0,value=0,additional_data={}){
    if(pdParent===window) return;
    try{
        pdParent.postMessage({playdeck:{method:'sendGameProgress',value:{
            achievements:[{name:String(name||'ACHIEVEMENT').slice(0,80),description:String(description||'').slice(0,180),points:Number(points)||0,value:Number(value)||0,additional_data:{...additional_data}}]
        }}},'*');
    }catch(e){}
}
window.PlayDeckIntegrationStatus=()=>({
    embedded:pdParent!==window, platform:playdeckPlatform, overlayOpen:!!playdeckOverlayOpen,
    cloudStatus:window.__playdeckCloudStatus||'unknown', cloudReady:window.__playdeckCloudReady===true,
    build:typeof GAME_BUILD_VERSION!=='undefined'?GAME_BUILD_VERSION:'5.9'
});
try {
    pdParent.postMessage({ playdeck: { method: 'loading', value: 1 } }, '*');
    if(pdParent!==window){
        pdParent.postMessage({playdeck:{method:'getPlatform'}},'*');
        requestPlayDeckState();
    }
} catch(e){}

window.addEventListener('message', ({ data }) => {
    const pd = data?.playdeck;
    if (!pd) return;
    if(pd.method==='getPlaydeckState'){
        playdeckOverlayOpen=!!pd.value; window.isPlayDeckOpened=playdeckOverlayOpen;
        if(playdeckOverlayOpen && typeof gameState!=='undefined' && gameState==='playing'){ try{ document.getElementById('btnPauseGame')?.click(); }catch(e){} }
        return;
    }
    if(pd.method==='getUserProfile'){
        const profile=pd.value||{};
        dailyPlayerName=String(profile.username||profile.firstName||'PLAYER').slice(0,24);
        acceptDailyChallengeParams(profile.params||{});
    }
    if(pd.method==='getPlatform'){ playdeckPlatform=String(pd.value||'unknown').slice(0,20); try{telemetryTrack('platform_detected',{platform:playdeckPlatform});}catch(e){} }
    if (pd.method === 'startAd') { telemetryTrack('ad_start',{placement:adContext||'unknown'}); setAdStatus('РЕКЛАМА ЗАПУЩЕНА…'); return; }
    if (pd.method === 'rewardedAd') { telemetryTrack('ad_rewarded',{placement:adContext||'unknown'}); grantAdReward(); return; }
    if (pd.method === 'errAd' || pd.method === 'skipAd' || pd.method === 'notFoundAd') {
        const msg = pd.method === 'skipAd' ? 'РЕКЛАМУ ПРОПУЩЕНО' : (pd.method === 'notFoundAd' ? 'РЕКЛАМА ЗАРАЗ НЕДОСТУПНА' : 'ПОМИЛКА РЕКЛАМИ');
        failAd(msg);
    }
});

let darkMatter = 0; let currentLevel = 1;
let runSeed = 0; let runNumber = 1; let runSectorsCleared = 0; const RUN_LENGTH = 40;
let runStarted = false; let runEnded = false;
let postRunShopPending = false; // Persisted route: after a finished run, reopening the app must land in SHOP.
// V5.5 THREAT SYSTEM: selected threat is chosen in SHOP, runThreatLevel is frozen for the active run.
let selectedThreatLevel = 0; let runThreatLevel = 0; let maxThreatUnlocked = 0; let lastThreatUnlock = 0;
const MAX_THREAT_LEVEL = 3;
// V5.9.22 CORE CHAMBER: BASELINE + three unlockable difficulty cores.
// Unlocks come from a 40/40 clear of the previous difficulty; no Dark Matter purchase/reward is attached.
const THREAT_UNLOCK_REWARDS = [0,0,0,0];
const THREAT_CONFIG = [
    {name:'BASELINE', enemyProd:1.00,eventBonus:0.00,reward:1.00,neutral:1.00,botAggro:0.00,act2Ffa:0.00,act3Ffa:.48,ffa4:.13,botOutpostBonus:0,bossHazards:0,rarityBoost:0.00},
    {name:'CORE I',   enemyProd:1.08,eventBonus:0.06,reward:1.08,neutral:1.05,botAggro:0.02,act2Ffa:.12,act3Ffa:.60,ffa4:.16,botOutpostBonus:0,bossHazards:0,rarityBoost:0.04},
    {name:'CORE II',  enemyProd:1.14,eventBonus:0.12,reward:1.18,neutral:1.10,botAggro:0.05,act2Ffa:.30,act3Ffa:.80,ffa4:.23,botOutpostBonus:0,bossHazards:0,rarityBoost:0.08},
    {name:'CORE III', enemyProd:1.20,eventBonus:0.18,reward:1.30,neutral:1.16,botAggro:0.08,act2Ffa:.46,act3Ffa:.92,ffa4:.30,botOutpostBonus:1,bossHazards:1,rarityBoost:0.12}
];
function threatConfig(level=runThreatLevel){ return THREAT_CONFIG[Math.max(0,Math.min(MAX_THREAT_LEVEL,Number(level)||0))] || THREAT_CONFIG[0]; }

// V5.6 DAILY OPERATION ------------------------------------------------------
// One deterministic challenge per UTC day. The seed, Threat level and Protocol
// choices are identical for everyone. Permanent power upgrades are disabled
// while the Daily Operation is active so every player gets the same fair challenge.
let dailyOperationActive = false;
let dailyOperationKey = '';
let dailyOperationStartedAt = 0;
let dailyOperationBestKey = '';
let dailyOperationBestSector = 0;
let dailyOperationBestTimeMs = 0;
let dailyOperationAttempts = 0;
let dailyOperationClaimedReward = 0;
let dailyOperationLastSector = 0;
let dailyOperationLastTimeMs = 0;
let dailyOperationLastReward = 0;
let dailyOperationRival = null;
let dailyPlayerName = 'PLAYER';
// A Daily Operation temporarily borrows the playfield. Preserve the prepared normal RUN
// exactly as it was so a Daily attempt never increments or destroys normal RUN state.
let dailyOperationReturnRunNumber = 0;
let dailyOperationReturnRunSeed = 0;
let dailyOperationReturnSelectedThreat = 0;
let dailyOperationReturnPostRunShop = false;
let dailyGameplayRngState = 0;

function dailyUtcKey(){
    return new Date().toISOString().slice(0,10);
}
function hashDailyString(str){
    let h=2166136261>>>0;
    for(let i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619)>>>0; }
    return h>>>0;
}
function dailySeedForKey(key=dailyUtcKey()){
    return (hashDailyString(`1BIT-SECTOR-DAILY:${key}`) ^ 0xD41170A5)>>>0 || 1;
}
function dailyThreatForKey(key=dailyUtcKey()){
    return 1 + (dailySeedForKey(key)%3);
}
function dailyOperationInfo(){
    const key=dailyUtcKey();
    if(dailyOperationBestKey!==key){
        dailyOperationBestKey=key;
        dailyOperationBestSector=0;
        dailyOperationBestTimeMs=0;
        dailyOperationAttempts=0;
        dailyOperationClaimedReward=0;
    }
    return {key,seed:dailySeedForKey(key),threat:dailyThreatForKey(key)};
}
function dailyRewardCap(sector){
    if(sector>=40) return 150;
    if(sector>=32) return 100;
    if(sector>=24) return 70;
    if(sector>=16) return 40;
    if(sector>=8) return 20;
    return 0;
}
function formatDailyTime(ms){
    if(!ms||ms<0) return '--:--';
    const sec=Math.floor(ms/1000), m=Math.floor(sec/60), sec2=sec%60;
    return `${String(m).padStart(2,'0')}:${String(sec2).padStart(2,'0')}`;
}
function dailyProtocolRunNumber(){
    return dailyOperationActive ? 0x5A17 : runNumber;
}
function resetDailyGameplayRng(seed=dailySeedForKey(dailyOperationKey||dailyUtcKey())){
    dailyGameplayRngState=((Number(seed)||1)^0x9E3779B9)>>>0 || 1;
}
function gameplayRandom(){
    if(!dailyOperationActive) return Math.random();
    // xorshift32: tiny, deterministic and persisted for resume fairness.
    let x=dailyGameplayRngState>>>0 || 1;
    x^=(x<<13); x^=(x>>>17); x^=(x<<5);
    dailyGameplayRngState=x>>>0;
    return (dailyGameplayRngState>>>0)/4294967296;
}
// V5.7 SOFT-LAUNCH TELEMETRY ----------------------------------------------
// Lightweight, privacy-safe gameplay analytics. No names/usernames are sent.
const GAME_BUILD_VERSION='5.9';
const TELEMETRY_STATE_KEY='1BitTelemetryState';
const TELEMETRY_DEBUG_KEY='1BitTelemetryDebug';
const telemetrySessionStartedAt=Date.now();
let telemetryState={firstSeen:Date.now(),sessions:0,lastSeen:0};
let telemetryBuffer=[];
let telemetryFlushTimer=null;
let telemetrySessionId=`s${Date.now().toString(36)}${Math.floor(Math.random()*0xfffff).toString(36)}`;
try{ const raw=JSON.parse(localStorage.getItem(TELEMETRY_STATE_KEY)||'null'); if(raw&&typeof raw==='object') telemetryState={...telemetryState,...raw}; }catch(e){}
telemetryState.sessions=(Number(telemetryState.sessions)||0)+1; telemetryState.lastSeen=Date.now();
try{ localStorage.setItem(TELEMETRY_STATE_KEY,JSON.stringify(telemetryState)); }catch(e){}
function telemetryLocale(){ try{return window.GameLanguage?.get?.()||document.documentElement.lang||navigator.language||'uk';}catch(e){return 'uk';} }
function telemetryMode(){ return dailyOperationActive?'daily':'normal'; }
function flushTelemetryDebug(){
    telemetryFlushTimer=null;
    try{
        const old=JSON.parse(localStorage.getItem(TELEMETRY_DEBUG_KEY)||'[]');
        const merged=(Array.isArray(old)?old:[]).concat(telemetryBuffer.splice(0)).slice(-180);
        localStorage.setItem(TELEMETRY_DEBUG_KEY,JSON.stringify(merged));
    }catch(e){ telemetryBuffer.length=0; }
}
function sendPlayDeckAnalytics(name, props={}){
    try{
        if(pdParent===window) return;
        pdParent.postMessage({playdeck:{method:'sendAnalytics',value:{
            name,
            type:'game',
            user_properties:{},
            event_properties:{name,...props}
        }}},'*');
    }catch(e){}
}
function telemetryTrack(name, props={}){
    const now=Date.now();
    const ev={
        event:String(name||'event'), build:GAME_BUILD_VERSION, session_id:telemetrySessionId,
        session_ms:Math.max(0,now-telemetrySessionStartedAt),
        session_number:Number(telemetryState.sessions)||1,
        day_since_first:Math.max(0,Math.floor((now-(Number(telemetryState.firstSeen)||now))/86400000)),
        mode:telemetryMode(), locale:String(telemetryLocale()).slice(0,8), platform:playdeckPlatform,
        sector:Number(currentLevel)||1, run:Number(runNumber)||1, threat:Number(runThreatLevel)||0,
        ...props
    };
    telemetryBuffer.push(ev);
    if(!telemetryFlushTimer) telemetryFlushTimer=setTimeout(flushTelemetryDebug,1200);
    sendPlayDeckAnalytics(ev.event,ev);
    return ev;
}
window.GameTelemetry={
    track:telemetryTrack,
    snapshot:()=>({buffer:[...telemetryBuffer],state:{...telemetryState},session_id:telemetrySessionId}),
    history:()=>{try{return JSON.parse(localStorage.getItem(TELEMETRY_DEBUG_KEY)||'[]');}catch(e){return [];}},
    clearDebug:()=>{try{localStorage.removeItem(TELEMETRY_DEBUG_KEY);}catch(e){}}
};
setTimeout(()=>{
    telemetryTrack('session_start',{
        returning:(Number(telemetryState.sessions)||1)>1, best_sector:Number(bestSector)||0,
        total_runs:Number(totalRuns)||0, full_clears:Number(completedRuns)||0,
        max_threat:Number(maxThreatUnlocked)||0, dark_matter:Number(darkMatter)||0
    });
},220);
let telemetryHiddenAt=0;
document.addEventListener('visibilitychange',()=>{
    if(document.hidden){ telemetryHiddenAt=Date.now(); telemetryTrack('session_background',{}); flushTelemetryDebug(); }
    else { telemetryTrack('session_resume',{away_ms:telemetryHiddenAt?Date.now()-telemetryHiddenAt:0}); telemetryHiddenAt=0; setTimeout(requestPlayDeckState,120); }
});
window.addEventListener('pagehide',flushTelemetryDebug);
// Low-frequency performance pulse piggybacks on the existing game loop (no extra RAF).
let telemetryFrames=0, telemetryFpsAt=performance.now();
function telemetryFrameTick(){
    telemetryFrames++;
    if((telemetryFrames & 63)!==0) return;
    const t=performance.now();
    if(t-telemetryFpsAt<30000) return;
    const fps=Math.round(telemetryFrames*1000/(t-telemetryFpsAt));
    if(gameState==='playing') telemetryTrack('performance_sample',{fps,units:units?.length||0,nodes:nodes?.length||0,particles:particles?.length||0});
    telemetryFrames=0; telemetryFpsAt=t;
}
function submitDailyScore(sector,timeMs){
    const timeBonus=Math.max(0,99999-Math.min(99999,Math.floor((timeMs||0)/1000)));
    const score=Math.max(0,sector)*100000+timeBonus;
    // Daily results are reported through the documented PlayDeck progress channel.
    try{ pdParent.postMessage({playdeck:{method:'sendGameProgress',value:{achievements:[{name:`DAILY ${dailyOperationKey||dailyUtcKey()}`,description:'Daily Operation result',points:score,value:sector,additional_data:{day:dailyOperationKey||dailyUtcKey(),time_ms:Math.round(timeMs||0)}}],progress:{level:sector,isLastLevel:sector>=RUN_LENGTH}}}},'*'); }catch(e){}
    telemetryTrack('daily_operation_result',{
        day:dailyOperationKey||dailyUtcKey(),sector,time_ms:Math.round(timeMs||0),
        attempts:dailyOperationAttempts,threat:runThreatLevel,score
    });
}
function registerDailyResult(sector,timeMs){
    const info=dailyOperationInfo();
    const cleared=Math.max(0,Math.min(RUN_LENGTH,Number(sector)||0));
    const elapsed=Math.max(0,Number(timeMs)||0);
    dailyOperationLastSector=cleared;
    dailyOperationLastTimeMs=elapsed;
    const better = cleared>dailyOperationBestSector ||
        (cleared===dailyOperationBestSector && cleared>0 && (!dailyOperationBestTimeMs || elapsed<dailyOperationBestTimeMs));
    if(better){
        dailyOperationBestSector=cleared;
        dailyOperationBestTimeMs=elapsed;
    }
    const cap=dailyRewardCap(dailyOperationBestSector);
    const delta=Math.max(0,cap-dailyOperationClaimedReward);
    if(delta>0){ darkMatter+=delta; dailyOperationClaimedReward=cap; }
    dailyOperationBestKey=info.key;
    submitDailyScore(dailyOperationBestSector,dailyOperationBestTimeMs);
    saveProgress();
    return {better,reward:delta,bestSector:dailyOperationBestSector,bestTimeMs:dailyOperationBestTimeMs};
}
function captureNormalRunForDaily(){
    dailyOperationReturnRunNumber=runNumber;
    dailyOperationReturnRunSeed=runSeed;
    dailyOperationReturnSelectedThreat=selectedThreatLevel;
    dailyOperationReturnPostRunShop=!!postRunShopPending;
}
function restoreNormalRunAfterDaily(){
    runNumber=dailyOperationReturnRunNumber||runNumber||1;
    runSeed=dailyOperationReturnRunSeed||makeRunSeed();
    selectedThreatLevel=Math.max(0,Math.min(maxThreatUnlocked,Number(dailyOperationReturnSelectedThreat)||0));
    currentLevel=1; runSectorsCleared=0; runStarted=false; runEnded=false;
    postRunShopPending=!!dailyOperationReturnPostRunShop;
    runThreatLevel=selectedThreatLevel; runMatter=0; runCaptured=0; runPayoutBanked=false;
    activeProtocols={}; protocolChoicePending=false; protocolChoiceLevel=0; awaitingNextSector=false;
    continueUsed=false; runAwaitingDecision=false; reviveBoostPending=false; lastRunPayout=0;
    doublePayoutAvailable=false; doublePayoutClaimed=false; protocolRerollNonce=0; protocolRerollUsedLevel=0; protocolPaidRerollUsedLevel=0; protocolBoostedRerollLevel=0;
    pendingReward=0; destroyedEnemies=0; levelWon=false;
}
function startDailyOperation(){
    const info=dailyOperationInfo();
    if(dailyOperationActive) return;
    captureNormalRunForDaily();
    dailyOperationActive=true;
    dailyOperationKey=info.key;
    dailyOperationStartedAt=Date.now();
    dailyOperationAttempts+=1;
    dailyOperationLastReward=0;
    runSeed=info.seed;
    resetDailyGameplayRng(info.seed);
    currentLevel=1;
    runSectorsCleared=0;
    runStarted=true;
    runEnded=false;
    postRunShopPending=false;
    runThreatLevel=info.threat;
    runMatter=0;
    runCaptured=0;
    runPayoutBanked=false;
    activeProtocols={};
    protocolChoicePending=false;
    protocolChoiceLevel=0;
    awaitingNextSector=false;
    // Competitive Daily: no revive and no ad reroll.
    continueUsed=true;
    runAwaitingDecision=false;
    reviveBoostPending=false;
    lastRunPayout=0;
    doublePayoutAvailable=false;
    doublePayoutClaimed=false;
    protocolRerollNonce=0;
    protocolRerollUsedLevel=0;
    protocolPaidRerollUsedLevel=0;
    protocolBoostedRerollLevel=0;
    saveProgress();
    telemetryTrack('daily_operation_start',{day:info.key,threat:info.threat,attempt:dailyOperationAttempts});
    try{ if(pdParent!==window) pdParent.postMessage({playdeck:{method:'sendAnalyticNewSession'}},'*'); }catch(e){}
    loadLevel(1);
}
function finishDailyOperation(completed=false){
    if(!dailyOperationActive) return null;
    if(completed) runSectorsCleared=RUN_LENGTH;
    const day=dailyOperationKey||dailyUtcKey();
    const elapsed=Math.max(0,Date.now()-(dailyOperationStartedAt||Date.now()));
    const result=registerDailyResult(runSectorsCleared,elapsed);
    dailyOperationLastReward=result.reward||0;
    telemetryTrack('daily_operation_finish',{day,cleared:runSectorsCleared,reached:currentLevel,time_ms:elapsed,completed:!!completed,reward:result.reward||0});
    dailyOperationActive=false;
    dailyOperationStartedAt=0;
    restoreNormalRunAfterDaily();
    saveProgress();
    notifyPlayDeckGameEnd(completed?'daily_complete':'daily_end');
    try{ window.__showDailyResult?.({...result,day,cleared:dailyOperationLastSector,timeMs:dailyOperationLastTimeMs,reward:dailyOperationLastReward,completed:!!completed}); }catch(e){}
    return result;
}
function leaveDailyOperation(){
    if(dailyOperationActive){
        dailyOperationActive=false; dailyOperationStartedAt=0; restoreNormalRunAfterDaily();
    }
    saveProgress();
    try{ window.__openDailyOperation?.(); }catch(e){}
}
function shareDailyChallenge(){
    const info=dailyOperationInfo();
    if(dailyOperationBestSector<=0) return false;
    const params={
        mode:'daily',
        day:info.key,
        sector:String(dailyOperationBestSector),
        time:String(Math.max(0,Math.round(dailyOperationBestTimeMs||0))),
        from:String(dailyPlayerName||'PLAYER').slice(0,24)
    };
    try{
        pdParent.postMessage({playdeck:{method:'customShare',value:params}},'*');
        telemetryTrack('daily_challenge_share',{day:info.key,sector:dailyOperationBestSector,time_ms:dailyOperationBestTimeMs||0});
        return true;
    }catch(e){ return false; }
}
function acceptDailyChallengeParams(params){
    if(!params||String(params.mode||'')!=='daily') return;
    const day=String(params.day||'');
    const sector=Math.max(0,Math.min(RUN_LENGTH,Number(params.sector)||0));
    const time=Math.max(0,Number(params.time)||0);
    if(!day||!sector) return;
    dailyOperationRival={day,sector,time,name:String(params.from||'RIVAL').slice(0,24)};
    telemetryTrack('daily_challenge_open',{day,sector,time_ms:time});
}

function unlockNextThreatAfterClear(){
    if(runSectorsCleared < RUN_LENGTH) return 0;
    const next=Math.min(MAX_THREAT_LEVEL, runThreatLevel+1);
    if(next<=maxThreatUnlocked || next<=runThreatLevel) return 0;
    maxThreatUnlocked=next; selectedThreatLevel=next; lastThreatUnlock=next;
    const reward=THREAT_UNLOCK_REWARDS[next]||0; if(reward>0) darkMatter+=reward; telemetryTrack('core_unlock',{core:next,reward});
    return next;
}
let runMatter = 0; let runCaptured = 0; let runPayoutBanked = false;
let bestSector = 0; let totalRuns = 0; let lifetimeSectors = 0; let lifetimeCaptured = 0;
let metaUnlocks = {};
// V3.2 RETENTION STATE
let achievementUnlocks = {};
let milestoneClaims = {};
let dailyState = { key:'', progress:0, claimed:false };
let dailyLastClaimKey = '';
let dailyStreak = 0;
let totalBosses = 0; let totalEventsCleared = 0; let totalProtocolsChosen = 0; let completedRuns = 0;
let retentionToast = '';
let activeProtocols = {}; let protocolChoicePending = false; let protocolChoiceLevel = 0; let awaitingNextSector = false;
let protocolPreviewSelection = ''; let metaTab = 'power'; let metaPreviewSelection = '';
// V3.0 MONETIZATION STATE
let adBusy = false; let adContext = null; let adStatus = ''; let adTimeout = null; let telemetryLastAdOffer='';
let continueUsed = false; let runAwaitingDecision = false; let reviveBoostPending = false;
let lastRunPayout = 0; let doublePayoutAvailable = false; let doublePayoutClaimed = false;
let protocolRerollNonce = 0; let protocolRerollUsedLevel = 0; let protocolPaidRerollUsedLevel = 0; let protocolBoostedRerollLevel = 0;
let upgSpeed = 1, upgCapacity = 1, upgProd = 1, upgArmor = 1, upgStart = 1, upgYield = 1;
let pendingReward = 0; let destroyedEnemies = 0; let levelWon = false;
let currentSectorEvent = null;
let sectorAlertTimer = null;


// V2.7 RUN PROTOCOLS -------------------------------------------------------
const PROTOCOLS = [
    { id:'overdrive',  name:'OVERDRIVE',      icon:'>>', cat:'mobility', rarity:'COMMON', max:2, desc:'+15% швидкості флоту за стек.' },
    { id:'industrial', name:'INDUSTRIAL',     icon:'++', cat:'economy',  rarity:'COMMON', max:2, desc:'+25% виробництва юнітів за стек.' },
    { id:'storage',    name:'DEEP STORAGE',   icon:'[]', cat:'economy',  rarity:'COMMON', max:2, desc:'+25 до ліміту юнітів на твоїх планетах.' },
    { id:'vanguard',   name:'VANGUARD',       icon:'^+', cat:'economy',  rarity:'COMMON', max:3, desc:'+10 стартових юнітів у кожному секторі.' },
    { id:'reinforced', name:'REINFORCED',     icon:'##', cat:'defense',  rarity:'COMMON', max:2, desc:'-12% шкоди по твоїх планетах за стек.' },
    { id:'swarm',      name:'SWARM LINK',     icon:'>>>',cat:'combat',   rarity:'COMMON', max:2, desc:'Відправляє +8% гарнізону за стек.' },
    { id:'dense',      name:'DENSE FLEET',    icon:'**', cat:'combat',   rarity:'COMMON', max:2, desc:'+0.25 сили кожної твоєї бойової одиниці.' },
    { id:'raiders',    name:'RAIDERS',        icon:'!!', cat:'combat',   rarity:'COMMON', max:2, desc:'+12% шкоди проти ворожих планет.' },
    { id:'colonizer',  name:'COLONIZER',      icon:'O+', cat:'combat',   rarity:'COMMON', max:2, desc:'+15% шкоди проти нейтральних планет.' },
    { id:'salvage',    name:'SALVAGE',        icon:'+O', cat:'utility',  rarity:'COMMON', max:2, desc:'+4 юніти на щойно захопленій планеті.' },
    { id:'turret',     name:'TURRET ARRAY',   icon:'|-', cat:'defense',  rarity:'COMMON', max:2, desc:'+1 шкоди захисних турелей твоїх баз.' },
    { id:'rapid',      name:'RAPID DEFENSE',  icon:'//', cat:'defense',  rarity:'COMMON', max:2, desc:'Турелі твоїх баз стріляють швидше.' },
    { id:'skimmer',    name:'ASTEROID SKIM',  icon:'~>', cat:'mobility', rarity:'COMMON', max:1, desc:'Астероїдні поля сповільнюють твій флот значно менше.' },
    { id:'phase',      name:'PHASE DRIVE',    icon:'()', cat:'portal',   rarity:'COMMON', max:1, desc:'Після порталу твій флот отримує +35% швидкості.' },
    { id:'phasearmor', name:'PHASE ARMOR',    icon:'O#', cat:'portal',   rarity:'COMMON', max:2, desc:'Прохід через портал додає +0.35 сили юніту.' },
    { id:'surge',      name:'REACTOR SURGE',  icon:'^^', cat:'economy',  rarity:'COMMON', max:1, desc:'Перші 25 секунд сектору: +60% виробництва.' },
    { id:'capital',    name:'CAPITAL CORE',   icon:'A+', cat:'defense',  rarity:'COMMON', max:2, desc:'+8 стартових юнітів і +0.5 шкоди турелей столиці.' },
    { id:'harvest',    name:'DARK HARVEST',   icon:'x$', cat:'utility',  rarity:'COMMON', max:2, desc:'+10% Темної Матерії за очищення сектору за стек.' },

    { id:'afterburn',  name:'AFTERBURN',      icon:'>>!',cat:'mobility', rarity:'RARE', max:1, lockedBy:'archive1', minSector:5, desc:'+20% швидкості флоту.' },
    { id:'forge',      name:'NANO FORGE',     icon:'N+', cat:'economy',  rarity:'RARE', max:1, lockedBy:'archive1', minSector:5, desc:'+20% виробництва.' },
    { id:'bulwark',    name:'BULWARK',        icon:'[#]',cat:'defense',  rarity:'RARE', max:1, lockedBy:'archive1', minSector:5, desc:'Ще -8% шкоди по твоїх планетах.' },
    { id:'predator',   name:'PREDATOR',       icon:'X!', cat:'combat',   rarity:'RARE', max:1, lockedBy:'archive2', minSector:7, desc:'+20% шкоди по ворогу.' },
    { id:'seedcore',   name:'SEED CORE',      icon:'+A', cat:'economy',  rarity:'RARE', max:1, lockedBy:'archive2', minSector:7, desc:'+15 стартових юнітів.' },
    { id:'riftmaster', name:'RIFT MASTER',    icon:'@@', cat:'portal',   rarity:'RARE', max:1, lockedBy:'archive2', minSector:7, desc:'Портали дають ще +25% швидкості.' },

    // V3.9 — build-changing protocol packs.
    { id:'pulsecore', name:'PULSE CORE', icon:'P+', cat:'hybrid', rarity:'RARE', max:1, lockedBy:'archive3', minSector:7, desc:'+10% швидкості та +12% виробництва.' },
    { id:'siegebreaker', name:'SIEGE BREAKER', icon:'B!', cat:'combat', rarity:'RARE', max:1, lockedBy:'archive3', minSector:9, desc:'+35% шкоди по Capital/WARDEN вузлах.' },
    { id:'chainlink', name:'CHAIN LINK', icon:'C+', cat:'utility', rarity:'RARE', max:1, lockedBy:'archive3', minSector:9, desc:'Захоплення дає +2 юніти кожній твоїй базі.' },
    { id:'voidwalker', name:'VOID WALKER', icon:'V~', cat:'mobility', rarity:'RARE', max:1, lockedBy:'archive3', minSector:9, desc:'Слабше сповільнення астероїдами та менша зона втягування чорних дір.' },
    { id:'deepreserve', name:'DEEP RESERVE', icon:'R+', cat:'economy', rarity:'RARE', max:1, lockedBy:'archive3', minSector:9, desc:'+35 capacity і +5 стартових юнітів.' },

    { id:'overclock', name:'OVERCLOCK', icon:'OC', cat:'economy', rarity:'EPIC', max:1, lockedBy:'doctrine1', minSector:11, desc:'+35% виробництва, але -18% capacity.' },
    { id:'glasscannon', name:'GLASS CANNON', icon:'GC', cat:'combat', rarity:'EPIC', max:1, lockedBy:'doctrine1', minSector:11, desc:'+30% шкоди по ворогу, але твої бази отримують +15% шкоди.' },
    { id:'emergencygrid', name:'EMERGENCY GRID', icon:'E!', cat:'economy', rarity:'EPIC', max:1, lockedBy:'doctrine1', minSector:11, desc:'+35% виробництва, коли в тебе лишилось 2 або менше вузлів.' },
    { id:'signaljam', name:'SIGNAL JAM', icon:'JX', cat:'utility', rarity:'EPIC', max:1, lockedBy:'doctrine1', minSector:11, desc:'AI атакує рідше та дає більше часу на перебудову.' },
    { id:'frontline', name:'FRONTLINE', icon:'F>', cat:'combat', rarity:'EPIC', max:1, lockedBy:'doctrine1', minSector:11, desc:'+10% шкоди по ворогу та +20% по нейтралах.' },

    { id:'reclaimer', name:'RECLAIMER', icon:'R$', cat:'utility', rarity:'EPIC', max:1, lockedBy:'doctrine2', minSector:15, desc:'+8 юнітів після захоплення та +10% RUN reward.' },
    { id:'gatecrash', name:'GATECRASH', icon:'G@', cat:'portal', rarity:'EPIC', max:1, lockedBy:'doctrine2', minSector:15, desc:'Портал дає ще +35% speed і +0.60 сили.' },
    { id:'momentum', name:'MOMENTUM', icon:'M>', cat:'mobility', rarity:'EPIC', max:1, lockedBy:'doctrine2', minSector:15, desc:'Перші 20 секунд сектору: +35% швидкості флоту.' },
    { id:'fortress', name:'FORTRESS', icon:'FT', cat:'defense', rarity:'EPIC', max:1, lockedBy:'doctrine2', minSector:15, desc:'+20 capacity і +1.5 шкоди захисних турелей.' },

    // V5.5 — CORRUPTED Protocols. They only enter the pool on THREAT III+.
    { id:'redline', name:'REDLINE', icon:'R!', cat:'mobility', rarity:'CORRUPTED', max:1, minThreat:3, minSector:9, desc:'+45% швидкості флоту, але -20% місткості баз.' },
    { id:'bloodforge', name:'BLOOD FORGE', icon:'B+', cat:'economy', rarity:'CORRUPTED', max:1, minThreat:3, minSector:11, desc:'+45% виробництва, але твої бази отримують +20% шкоди.' },
    { id:'warhunger', name:'WAR HUNGER', icon:'W!', cat:'combat', rarity:'CORRUPTED', max:1, minThreat:3, minSector:13, desc:'+40% шкоди по ворогу, але AI стає агресивнішим.' },
    { id:'darktithe', name:'DARK TITHE', icon:'D$', cat:'utility', rarity:'CORRUPTED', max:1, minThreat:3, minSector:15, desc:'+35% нагороди RUN, але -10 стартових юнітів.' }
]
const PROTOCOL_BY_ID = Object.fromEntries(PROTOCOLS.map(p => [p.id,p]));
let sectorStartTime = 0;
function protocolCount(id){ return activeProtocols[id] || 0; }
function totalProtocolStacks(){ return Object.values(activeProtocols).reduce((a,b)=>a+b,0); }
function runPowerTier(){ return Math.min(5, Math.floor((Math.max(1,currentLevel)-1)/8)+1); }
// V5.9.27 BALANCE PASS 2: keep ACT I approachable, then raise pressure gradually.
// This curve is independent from CORE difficulty; CORE multiplies on top of it.
function runDifficultyCurve(level=currentLevel){
    const act=Math.max(1,Math.min(5,Math.floor((Math.max(1,level)-1)/8)+1));
    return {
        act,
        enemyProd:[1,1.00,1.03,1.07,1.12,1.18][act] || 1,
        enemyStart:[0,0,2,5,9,14][act] || 0,
        enemyOutpost:[0,0,1,2,4,6][act] || 0,
        neutral:[1,1.00,1.02,1.04,1.06,1.08][act] || 1,
        bossStart:[1,1.00,1.02,1.05,1.08,1.12][act] || 1
    };
}
function protocolEffects(){
    const tier=runPowerTier(); const scale=[0,1,1.18,1.36,1.54,1.72][tier] || 1;
    const me=metaEffects();
    const glass=protocolCount('glasscannon');
    const overclock=protocolCount('overclock');
    const redline=protocolCount('redline');
    const bloodforge=protocolCount('bloodforge');
    const warhunger=protocolCount('warhunger');
    const darktithe=protocolCount('darktithe');
    return {
        speed: me.speed * (1 + .15*scale*protocolCount('overdrive') + .20*protocolCount('afterburn') + .10*protocolCount('pulsecore') + .45*redline),
        prod: me.prod * (1 + .25*scale*protocolCount('industrial') + .20*protocolCount('forge') + .12*protocolCount('pulsecore') + .35*overclock + .45*bloodforge),
        capacity: 25*scale*protocolCount('storage') + 35*protocolCount('deepreserve') + 20*protocolCount('fortress'),
        capacityFactor: (overclock ? .82 : 1) * (redline ? .80 : 1),
        start: Math.max(0, me.start + scale*(10*protocolCount('vanguard') + 8*protocolCount('capital')) + 15*protocolCount('seedcore') + 5*protocolCount('deepreserve') - 10*darktithe),
        armor: Math.max(.48, (1 - .12*protocolCount('reinforced') - .08*protocolCount('bulwark')) * (glass ? 1.15 : 1) * (bloodforge ? 1.20 : 1)),
        sendRatio: Math.min(.82, .50 + .08*protocolCount('swarm')),
        unitHp: .25*scale*protocolCount('dense'),
        enemyDamage: 1 + .12*scale*protocolCount('raiders') + .20*protocolCount('predator') + .30*glass + .10*protocolCount('frontline') + .40*warhunger,
        neutralDamage: 1 + .15*scale*protocolCount('colonizer') + .20*protocolCount('frontline'),
        bossDamage: 1 + .35*protocolCount('siegebreaker'),
        captureBonus: 4*scale*protocolCount('salvage') + 8*protocolCount('reclaimer'),
        capturePulse: 2*protocolCount('chainlink'),
        turretDamage: 1*protocolCount('turret') + 1.5*protocolCount('fortress'),
        turretCooldown: Math.pow(.82, protocolCount('rapid')),
        asteroidSlow: protocolCount('voidwalker') ? .88 : (protocolCount('skimmer') ? .72 : .40),
        blackholeSafe: protocolCount('voidwalker') ? .68 : 1,
        phaseSpeed: (protocolCount('phase') ? 1.35 : 1) + .25*protocolCount('riftmaster') + .35*protocolCount('gatecrash'),
        phaseArmor: .35*protocolCount('phasearmor') + .60*protocolCount('gatecrash'),
        surge: protocolCount('surge') ? 1.60 : 1,
        openingSpeed: protocolCount('momentum') ? 1.35 : 1,
        comebackProd: protocolCount('emergencygrid') ? 1.35 : 1,
        botAggro: (protocolCount('signaljam') ? -0.10 : 0) + .08*warhunger,
        capitalTurret: .5*protocolCount('capital'),
        reward: 1 + .10*protocolCount('harvest') + .06*protocolCount('reclaimer') + .20*darktithe
    };
}
function protocolBuildMarkup(){
    const owned=PROTOCOLS.filter(p=>protocolCount(p.id)>0);
    const stacks=totalProtocolStacks();
    if(!stacks) return '<div class="build-summary empty"><span>RUN BUILD</span><b>0</b><small>NO PROTOCOLS YET</small></div>';
    return `<div class="build-summary"><span>RUN BUILD</span><b>${stacks}</b><small>${owned.length} TYPES</small></div>`;
}
function protocolChoicesForSector(level){
    const seed=((runSeed>>>0) ^ Math.imul(level+101,0x9E3779B1) ^ Math.imul(dailyProtocolRunNumber()+7,0x85EBCA6B) ^ Math.imul(protocolRerollNonce+1,0x27D4EB2D))>>>0;
    const rng=seededRng(seed||1);
    const boosted=!dailyOperationActive && protocolBoostedRerollLevel===level;
    let pool=PROTOCOLS.filter(p=>protocolCount(p.id)<p.max && (!p.lockedBy || dailyOperationActive || metaOwned(p.lockedBy)) && level >= (p.minSector||1) && runThreatLevel >= (p.minThreat||0)).map(p=>{
        const rarity=p.rarity||'COMMON';
        // Archive unlocks should feel real. RARE is still uncommon early, but no longer
        // suppressed so heavily that a player can reach mid-run without seeing one.
        let penalty=(rarity==='EPIC'||rarity==='CORRUPTED')?Math.max(0,.62-level*.024):(rarity==='RARE'?Math.max(0,.18-level*.008):0);
        const coreRarityBoost=Number(threatConfig().rarityBoost)||0;
        if(rarity==='RARE') penalty=Math.max(0,penalty-coreRarityBoost);
        if(rarity==='EPIC') penalty=Math.max(0,penalty-coreRarityBoost*.75);
        if(boosted && rarity==='RARE') penalty=Math.max(0,penalty-.14);
        if(boosted && rarity==='EPIC') penalty=Math.max(0,penalty-.20);
        return {...p,roll:rng()+penalty};
    });
    pool.sort((a,b)=>a.roll-b.roll);
    const chosen=[]; const usedCats=new Set();
    for(const p of pool){ if(!usedCats.has(p.cat)){ chosen.push(p); usedCats.add(p.cat); } if(chosen.length===3) break; }
    for(const p of pool){ if(chosen.length===3) break; if(!chosen.some(x=>x.id===p.id)) chosen.push(p); }
    // BOOSTED REROLL: when an unlocked/eligible RARE or EPIC exists, guarantee at
    // least one such card. CORRUPTED is deliberately excluded because it is a trade-off.
    if(boosted && !chosen.some(p=>p.rarity==='RARE'||p.rarity==='EPIC')){
        const rarePlus=pool.find(p=>p.rarity==='EPIC') || pool.find(p=>p.rarity==='RARE');
        if(rarePlus){
            if(chosen.length<3) chosen.push(rarePlus);
            else chosen[chosen.length-1]=rarePlus;
        }
    }
    return chosen.slice(0,3);
}
function protocolRerollCost(level=protocolChoiceLevel||currentLevel){
    const act=Math.max(1,Math.min(5,Math.floor((Math.max(1,level)-1)/8)+1));
    return [0,12,16,20,24,28][act];
}
function buyProtocolReroll(){
    if(!protocolChoicePending || dailyOperationActive || protocolPaidRerollUsedLevel===protocolChoiceLevel) return false;
    const cost=protocolRerollCost(protocolChoiceLevel||currentLevel);
    if(runMatter<cost) return false;
    runMatter-=cost; protocolRerollNonce+=1; protocolPaidRerollUsedLevel=protocolChoiceLevel; protocolBoostedRerollLevel=0; protocolPreviewSelection='';
    telemetryTrack('protocol_reroll',{sector:protocolChoiceLevel||currentLevel,kind:'run_bank',cost,run_bank:runMatter});
    saveProgress(); renderProtocolChoice(); renderMonetizationPanel(); return true;
}
function projectedProtocolEffects(id){
    const prev=protocolCount(id);
    activeProtocols[id]=prev+1;
    const fx=protocolEffects();
    if(prev) activeProtocols[id]=prev; else delete activeProtocols[id];
    return fx;
}
function fmtMul(v){ return `${Math.round(v*100)}%`; }
function fmtFlat(v,sign=true){ const n=Math.round(v*10)/10; return `${sign&&n>0?'+':''}${n}`; }
function protocolCompareRows(p){
    const b=protocolEffects(), a=projectedProtocolEffects(p.id);
    const row=(label,before,after)=>({label,before,after});
    const mul=(label,k)=>row(label,fmtMul(b[k]),fmtMul(a[k]));
    const flat=(label,k)=>row(label,fmtFlat(b[k]),fmtFlat(a[k]));
    switch(p.id){
        case 'overdrive': case 'afterburn': return [mul('FLEET SPEED','speed')];
        case 'industrial': case 'forge': return [mul('PRODUCTION','prod')];
        case 'storage': return [flat('CAP BONUS','capacity')];
        case 'vanguard': case 'seedcore': return [flat('START UNITS','start')];
        case 'reinforced': case 'bulwark': return [mul('DAMAGE TAKEN','armor')];
        case 'swarm': return [mul('SEND RATIO','sendRatio')];
        case 'dense': return [row('UNIT POWER',fmtFlat(1+b.unitHp,false),fmtFlat(1+a.unitHp,false))];
        case 'raiders': case 'predator': return [mul('ENEMY DAMAGE','enemyDamage')];
        case 'colonizer': return [mul('NEUTRAL DAMAGE','neutralDamage')];
        case 'salvage': return [flat('CAPTURE BONUS','captureBonus')];
        case 'turret': return [flat('TURRET DAMAGE','turretDamage')];
        case 'rapid': return [mul('TURRET COOLDOWN','turretCooldown')];
        case 'skimmer': return [mul('FIELD SPEED','asteroidSlow')];
        case 'phase': case 'riftmaster': return [mul('PORTAL SPEED','phaseSpeed')];
        case 'phasearmor': return [row('PORTAL POWER',fmtFlat(1+b.phaseArmor,false),fmtFlat(1+a.phaseArmor,false))];
        case 'surge': return [mul('OPENING PROD','surge')];
        case 'capital': return [flat('START UNITS','start'),flat('CAPITAL TURRET','capitalTurret')];
        case 'harvest': return [mul('RUN REWARD','reward')];
        case 'pulsecore': return [mul('FLEET SPEED','speed'),mul('PRODUCTION','prod')];
        case 'siegebreaker': return [mul('BOSS DAMAGE','bossDamage')];
        case 'chainlink': return [flat('ALL BASES / CAPTURE','capturePulse')];
        case 'voidwalker': return [mul('FIELD SPEED','asteroidSlow'),mul('BLACK HOLE ZONE','blackholeSafe')];
        case 'deepreserve': return [flat('CAP BONUS','capacity'),flat('START UNITS','start')];
        case 'overclock': return [mul('PRODUCTION','prod'),mul('CAPACITY','capacityFactor')];
        case 'glasscannon': return [mul('ENEMY DAMAGE','enemyDamage'),mul('DAMAGE TAKEN','armor')];
        case 'emergencygrid': return [mul('COMEBACK PROD','comebackProd')];
        case 'signaljam': return [row('AI PRESSURE',fmtMul(1+b.botAggro),fmtMul(1+a.botAggro))];
        case 'frontline': return [mul('ENEMY DAMAGE','enemyDamage'),mul('NEUTRAL DAMAGE','neutralDamage')];
        case 'reclaimer': return [flat('CAPTURE BONUS','captureBonus'),mul('RUN REWARD','reward')];
        case 'gatecrash': return [mul('PORTAL SPEED','phaseSpeed'),row('PORTAL POWER',fmtFlat(1+b.phaseArmor,false),fmtFlat(1+a.phaseArmor,false))];
        case 'momentum': return [mul('OPENING SPEED','openingSpeed')];
        case 'fortress': return [flat('CAP BONUS','capacity'),flat('TURRET DAMAGE','turretDamage')];
        default: return [row('EFFECT','CURRENT','UPGRADED')];
    }
}
function protocolCompareMarkup(p){
    if(!p) return '';
    return `<section class="choice-focus protocol-focus sim-focus">
        <div class="choice-focus-head"><span class="choice-icon">${p.icon}</span><div><small>${p.rarity||'COMMON'} // ${p.cat.toUpperCase()}</small><h2>${p.name}</h2></div><span class="choice-stack">${protocolCount(p.id)}/${p.max}</span></div>
        <p class="choice-desc">${p.desc}</p>
        <div class="sim-stage-wrap"><canvas class="sim-stage" data-sim-protocol="${p.id}" aria-label="Protocol effect preview"></canvas><span class="sim-live-badge">AUTO COMPARE</span></div>
        <button class="choice-primary protocol-confirm" data-protocol-confirm="${p.id}">ВЗЯТИ ${p.name}</button>
    </section>`;
}
function renderProtocolChoice(){
    const panel=document.getElementById('protocolPanel'); if(!panel) return;
    if(!protocolChoicePending){ protocolPreviewSelection=''; panel.innerHTML=protocolBuildMarkup(); panel.classList.remove('choosing'); return; }
    const choices=protocolChoicesForSector(protocolChoiceLevel || currentLevel);
    if(!choices.some(p=>p.id===protocolPreviewSelection)) protocolPreviewSelection=choices[0]?.id||'';
    const selected=choices.find(p=>p.id===protocolPreviewSelection)||choices[0];
    panel.classList.add('choosing');
    const tierName=['','STANDARD','AMPLIFIED','OVERCHARGED','ASCENDANT','SINGULARITY'][runPowerTier()] || 'STANDARD';
    panel.innerHTML=`<div class="menu-step"><b>1 / 3</b><span>ОБЕРИ ПРОТОКОЛ</span><small>${tierName}</small></div>
        <div class="protocol-picker">${choices.map((p,i)=>`<button class="protocol-pick ${p.id===selected?.id?'selected':''}" data-protocol-preview="${p.id}"><span>${p.icon}</span><b>${p.name}</b><small>${p.rarity||'COMMON'}</small></button>`).join('')}</div>
        ${protocolCompareMarkup(selected)}
        ${protocolBuildMarkup()}`;
    const simCanvas=panel.querySelector('[data-sim-protocol]');
    if(simCanvas&&selected&&window.SimPreview){ window.SimPreview.protocol(simCanvas,selected.id,protocolEffects(),projectedProtocolEffects(selected.id)); }
    panel.querySelectorAll('[data-protocol-preview]').forEach(btn=>btn.addEventListener('click',()=>{protocolPreviewSelection=btn.dataset.protocolPreview;renderProtocolChoice();window.PolishFX?.event('select');}));
    panel.querySelectorAll('[data-protocol-confirm]').forEach(btn=>btn.addEventListener('click',()=>chooseProtocol(btn.dataset.protocolConfirm)));
}
function chooseProtocol(id){
    if(!protocolChoicePending) return;
    const p=PROTOCOL_BY_ID[id]; if(!p || protocolCount(id)>=p.max) return;
    const legal=protocolChoicesForSector(protocolChoiceLevel || currentLevel).some(x=>x.id===id); if(!legal) return;
    activeProtocols[id]=protocolCount(id)+1; telemetryTrack('protocol_choice',{protocol:id,rarity:p.rarity||'COMMON',stack:protocolCount(id),power_tier:runPowerTier(),choice_sector:protocolChoiceLevel||currentLevel}); protocolPreviewSelection=''; totalProtocolsChosen+=1; addDailyProgress('protocol',1); syncRetentionRewards(); protocolChoicePending=false; protocolChoiceLevel=0; awaitingNextSector=true; protocolRerollNonce=0; protocolRerollUsedLevel=0; protocolPaidRerollUsedLevel=0; protocolBoostedRerollLevel=0; saveProgress();
    renderProtocolChoice(); renderRetentionPanel(false); renderMonetizationPanel();
    const title=document.getElementById('shopTitle'); if(title) title.textContent=`>_${p.name} ПІДКЛЮЧЕНО`;
    const sub=document.getElementById('shopSubtitle'); if(sub) sub.textContent=p.desc;
    const btn=document.getElementById('btnAction'); if(btn){ btn.style.display='block'; btn.disabled=false; btn.textContent='НАСТУПНИЙ СЕКТОР >>'; }
}


// V3.0 PLAYDECK REWARDED MONETIZATION -------------------------------------
function isLocalAdTest(){ return pdParent === window; }
function setAdStatus(msg){ adStatus=msg||''; renderMonetizationPanel(); }
function clearAdState(){
    adBusy=false; adContext=null;
    if(adTimeout){ clearTimeout(adTimeout); adTimeout=null; }
}
function requestRewardedAd(context){
    if(adBusy) return;
    telemetryTrack('ad_request',{placement:context});
    adBusy=true; adContext=context; adStatus='ПІДКЛЮЧЕННЯ ДО РЕКЛАМИ…'; renderMonetizationPanel();
    if(isLocalAdTest()){
        adTimeout=setTimeout(()=>{ if(adBusy){ telemetryTrack('ad_rewarded',{placement:adContext||context,local_test:true}); grantAdReward(); } }, 350);
        return;
    }
    try {
        pdParent.postMessage({ playdeck: { method: 'showAd' } }, '*');
        adTimeout=setTimeout(()=>{ if(adBusy) failAd('РЕКЛАМА НЕ ВІДПОВІДАЄ'); }, 25000);
    } catch(e){ failAd('РЕКЛАМА НЕДОСТУПНА'); }
}
function failAd(msg){ const placement=adContext||'unknown'; telemetryTrack('ad_fail',{placement,reason:String(msg||'unavailable').slice(0,80)}); clearAdState(); adStatus=msg||'РЕКЛАМА НЕДОСТУПНА'; renderMonetizationPanel(); }
function grantAdReward(){
    if(!adBusy || !adContext) return;
    const ctx=adContext; clearAdState(); adStatus='НАГОРОДУ ОТРИМАНО';
    if(ctx==='continue') rewardContinueRun();
    else if(ctx==='double') rewardDoublePayout();
    else if(ctx==='reroll') rewardProtocolReroll();
    else renderMonetizationPanel();
}
function rewardContinueRun(){
    if(!runAwaitingDecision || continueUsed){ renderMonetizationPanel(); return; }
    continueUsed=true; runAwaitingDecision=false; runEnded=false; runStarted=true; reviveBoostPending=true; telemetryTrack('run_revive',{sector:currentLevel,build_stacks:totalProtocolStacks(),run_bank:runMatter});
    saveProgress();
    const shop=document.getElementById('shopUI'); if(shop) shop.classList.remove('open');
    loadLevel(currentLevel);
}
function rewardDoublePayout(){
    if(!doublePayoutAvailable || doublePayoutClaimed || lastRunPayout<=0){ renderMonetizationPanel(); return; }
    darkMatter += lastRunPayout; doublePayoutClaimed=true; doublePayoutAvailable=false; telemetryTrack('payout_double',{bonus:lastRunPayout,dm_after:darkMatter}); adStatus=`BONUS +${lastRunPayout} ✦`;
    saveProgress(); updateShopUI(); renderMetaPanel(true); renderRetentionPanel(true); renderMonetizationPanel();
}
function rewardProtocolReroll(){
    if(!protocolChoicePending || protocolRerollUsedLevel===protocolChoiceLevel){ renderMonetizationPanel(); return; }
    protocolRerollNonce += 1; protocolRerollUsedLevel=protocolChoiceLevel; protocolBoostedRerollLevel=protocolChoiceLevel; protocolPreviewSelection=''; telemetryTrack('protocol_reroll',{sector:protocolChoiceLevel||currentLevel,kind:'boosted_ad'}); adStatus='BOOSTED REROLL // RARE+ CHANCE ↑';
    saveProgress(); renderProtocolChoice(); renderMonetizationPanel();
}
function renderMonetizationPanel(){
    const panel=document.getElementById('adPanel'); if(!panel) return;
    let offer='';
    if(runAwaitingDecision && !continueUsed){
        offer=`<button class="reward-ad decision-continue" data-ad-offer="continue" ${adBusy?'disabled':''}><b>▶ ДРУГИЙ ШАНС</b><span>Повтори сектор. BUILD і RUN BANK залишаються.</span><small>REWARDED AD // 1 РАЗ ЗА RUN // +20 UNITS</small></button>`;
    } else if(protocolChoicePending && !dailyOperationActive && protocolRerollUsedLevel!==protocolChoiceLevel){
        offer=`<button class="reward-ad" data-ad-offer="reroll" ${adBusy?'disabled':''}><b>↻ BOOSTED REROLL</b><span>Реклама → нові 3 Protocols · RARE+ CHANCE ↑</span><small>Якщо RARE+ уже відкритий і доступний — мінімум 1 у наборі</small></button>`;
    } else if(runEnded && doublePayoutAvailable && !doublePayoutClaimed && lastRunPayout>0){
        offer=`<button class="reward-ad" data-ad-offer="double" ${adBusy?'disabled':''}><b>✦ x2 DARK MATTER</b><span>Реклама → ще +${lastRunPayout} ✦</span><small>тільки після завершення RUN</small></button>`;
    }
    const offerKey=runAwaitingDecision&&!continueUsed?'continue':(protocolChoicePending&&!dailyOperationActive&&protocolRerollUsedLevel!==protocolChoiceLevel?'reroll':(runEnded&&doublePayoutAvailable&&!doublePayoutClaimed&&lastRunPayout>0?'double':''));
    if(offerKey && offerKey!==telemetryLastAdOffer){ telemetryLastAdOffer=offerKey; telemetryTrack('ad_offer',{placement:offerKey}); }
    if(!offerKey) telemetryLastAdOffer='';
    if(!offer && !adStatus){ panel.innerHTML=''; panel.classList.remove('open'); return; }
    panel.classList.add('open');
    const local=isLocalAdTest()?'<div class="ad-test">LOCAL TEST // нагорода видається без реальної реклами</div>':'';
    panel.innerHTML=`<div class="ad-heading">${runAwaitingDecision?'SECOND CHANCE':'OPTIONAL BOOST'}</div>${offer}${adStatus?`<div class="ad-status">${adStatus}</div>`:''}${local}`;
    panel.querySelectorAll('[data-ad-offer]').forEach(btn=>btn.addEventListener('click',()=>requestRewardedAd(btn.dataset.adOffer)));
}
function projectedRunPayout(){
    const bonus=Math.max(0, Math.floor(runMatter * (metaEffects().reward-1)));
    return Math.floor(runMatter + bonus);
}
function finalizeFailedRun(){
    if(!runAwaitingDecision) return;
    runAwaitingDecision=false; runEnded=true;
    const reached=currentLevel, capturedThisRun=runCaptured, payout=bankRunPayout();
    lastRunPayout=payout; doublePayoutAvailable=payout>0; doublePayoutClaimed=false; telemetryTrack('run_end',{result:'failed',reached:reached,cleared:runSectorsCleared,payout,captured:capturedThisRun,build_stacks:totalProtocolStacks(),continued:!!continueUsed});
    const title=document.getElementById('shopTitle'); if(title) title.textContent='>_RUN ПЕРЕРВАНО';
    const sub=document.getElementById('shopSubtitle'); if(sub) sub.textContent=`RUN #${runNumber} • СЕКТОР ${String(reached).padStart(3,'0')}`;
    const stats=document.getElementById('runStats'); const available=nextAffordableUnlock();
    if(stats) stats.innerHTML=compactRunStats([['REACHED',String(reached).padStart(3,'0'),false],['CAPTURED',String(capturedThisRun),false],['PAYOUT',`+${payout} ✦`,true]]) + (available?`<div class="unlock-ready">UNLOCK READY // ${available.name}</div>`:'');
    protocolChoicePending=false; protocolChoiceLevel=0; awaitingNextSector=false; runStarted=false;
    saveProgress(); notifyPlayDeckGameEnd('run_failed'); setShopMode('end'); renderProtocolChoice(); clearMenuPanels(); renderMenuQuickNav('end'); renderMonetizationPanel();
    const btn=document.getElementById('btnAction'); if(btn){ btn.style.display='block'; btn.disabled=false; btn.textContent='НОВИЙ RUN >>'; }
}



// V3.2 RETENTION LAYER -----------------------------------------------------
const RETENTION_MILESTONES = [
    { id:'s4',  sector:4,  reward:10 },
    { id:'s8',  sector:8,  reward:15 },
    { id:'s12', sector:12, reward:20 },
    { id:'s16', sector:16, reward:25 },
    { id:'s20', sector:20, reward:30 },
    { id:'s24', sector:24, reward:35 },
    { id:'s28', sector:28, reward:40 },
    { id:'s32', sector:32, reward:50 },
    { id:'s36', sector:36, reward:60 },
    { id:'s40', sector:40, reward:85 }
];
const ACHIEVEMENTS = [
    { id:'first_run', name:'SIGNAL FOUND', reward:15, desc:'Заверши перший RUN.', test:()=>totalRuns>=1 },
    { id:'deep8', name:'DEEP SCAN', reward:20, desc:'Дістанься сектора 008.', test:()=>bestSector>=8 },
    { id:'capt50', name:'CLAIM 50', reward:25, desc:'Захопи 50 вузлів загалом.', test:()=>lifetimeCaptured>=50 },
    { id:'events5', name:'ANOMALY WALKER', reward:30, desc:'Очисти 5 секторів з аномаліями.', test:()=>totalEventsCleared>=5 },
    { id:'proto20', name:'BUILD ENGINEER', reward:35, desc:'Обери 20 протоколів.', test:()=>totalProtocolsChosen>=20 },
    { id:'warden3', name:'WARDEN BREAKER', reward:50, desc:'Знищ 3 WARDEN-боси.', test:()=>totalBosses>=3 },
    { id:'warden5', name:'WARDEN HUNTER', reward:85, desc:'Знищ 5 WARDEN-босів.', test:()=>totalBosses>=5 },
    { id:'veteran10', name:'TEN RUNS', reward:55, desc:'Заверши 10 RUN.', test:()=>totalRuns>=10 },
    { id:'fullclear', name:'SECTOR ZERO', reward:90, desc:'Заверши повний RUN.', test:()=>completedRuns>=1 },
    { id:'deep40', name:'DEEP 040', reward:120, desc:'Дістанься сектора 040.', test:()=>bestSector>=40 }
];
function todayKey(){ return new Date().toISOString().slice(0,10); }
function prevDayKey(key){
    const d=new Date(key+'T00:00:00Z'); d.setUTCDate(d.getUTCDate()-1); return d.toISOString().slice(0,10);
}
function hashText(str){
    let h=2166136261>>>0;
    for(let i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619); }
    return h>>>0;
}
function addDailyProgress(kind, amount=1){
    // Legacy Daily Signal retired. Calls remain as harmless no-ops for save/code compatibility.
    return false;
}
function syncRetentionRewards(){
    const messages=[];
    for(const m of RETENTION_MILESTONES){
        if(bestSector>=m.sector && !milestoneClaims[m.id]){
            milestoneClaims[m.id]=true; darkMatter+=m.reward; telemetryTrack('milestone_unlock',{milestone:m.id,sector:m.sector,reward:m.reward});
            reportPlayDeckAchievement(`SECTOR ${String(m.sector).padStart(3,'0')}`,`Reach sector ${m.sector}`,m.reward,m.sector,{kind:'milestone'});
            messages.push(`S${String(m.sector).padStart(3,'0')} +${m.reward}`);
        }
    }
    for(const a of ACHIEVEMENTS){
        if(!achievementUnlocks[a.id] && a.test()){
            achievementUnlocks[a.id]=true; darkMatter+=a.reward; telemetryTrack('achievement_unlock',{achievement:a.id,reward:a.reward});
            reportPlayDeckAchievement(a.name,a.desc||'1-Bit Sector achievement',a.reward,1,{id:a.id});
            messages.push(`${a.name} +${a.reward}`);
        }
    }
    if(messages.length) retentionToast=`UNLOCK // ${messages.join(' // ')} ✦`;
}
function nextMilestone(){ return RETENTION_MILESTONES.find(m=>!milestoneClaims[m.id]) || null; }
function retentionCompactMarkup(){
    const next=nextMilestone();
    const milestonePct=next?Math.min(100,Math.floor((bestSector/next.sector)*100)):100;
    const unlocked=ACHIEVEMENTS.filter(a=>achievementUnlocks[a.id]).length;
    return `<div class="retention-compact">
        <div class="retention-row"><span>NEXT MILESTONE</span><b>${next?`S${String(next.sector).padStart(3,'0')} // +${next.reward} ✦`:'ALL CLEARED'}</b></div>
        <div class="progress-track"><i style="width:${milestonePct}%"></i></div>
        <div class="retention-row"><span>ACHIEVEMENTS</span><b>${unlocked}/${ACHIEVEMENTS.length}</b></div>
    </div>`;
}
function renderRetentionPanel(expanded=false){
    const panel=document.getElementById('retentionPanel'); if(!panel) return;
    const unlocked=ACHIEVEMENTS.filter(a=>achievementUnlocks[a.id]).length;
    const toast=retentionToast?`<div class="retention-toast">${retentionToast}</div>`:'';
    if(!expanded){
        panel.innerHTML=`${toast}${retentionCompactMarkup()}`;
        panel.classList.add('open'); return;
    }
    const achievements=ACHIEVEMENTS.map(a=>{
        const done=!!achievementUnlocks[a.id];
        return `<div class="achievement-card ${done?'done':''}">
            <b>${done?'✓':'·'} ${a.name}</b><span>${a.desc}</span><small>${done?'UNLOCKED':`+${a.reward} ✦`}</small>
        </div>`;
    }).join('');
    panel.innerHTML=`${toast}<div class="retention-heading">PROGRESS</div>
        <div class="retention-summary"><span>ACH ${unlocked}/${ACHIEVEMENTS.length}</span><span>BEST ${String(bestSector).padStart(3,'0')}</span></div>
        ${retentionCompactMarkup()}
        <div class="achievement-grid">${achievements}</div>`;
    panel.classList.add('open');
    retentionToast='';
}

// V2.9 META PROGRESSION ----------------------------------------------------
const META_NODES = [
    // POWER — three visible levels per upgrade. Old save ids are intentionally preserved.
    { id:'startcache', name:'START CACHE',     cost:150,  tag:'POWER I',   desc:'+2 стартові юніти у кожному секторі.' },
    { id:'cache2',     name:'START CACHE II',  cost:400,  tag:'POWER II',  desc:'Ще +2 стартові юніти.', requires:'startcache' },
    { id:'cache3',     name:'START CACHE III', cost:800,  tag:'POWER III', desc:'Ще +3 стартові юніти.', requires:'cache2' },
    { id:'reactor',    name:'REACTOR TUNE',    cost:200,  tag:'POWER I',   desc:'+3% постійного виробництва.' },
    { id:'reactor2',   name:'REACTOR TUNE II', cost:450,  tag:'POWER II',  desc:'Ще +3% постійного виробництва.', requires:'reactor' },
    { id:'reactor3',   name:'REACTOR TUNE III',cost:900,  tag:'POWER III', desc:'Ще +4% постійного виробництва.', requires:'reactor2' },
    { id:'navcore',    name:'NAV CORE',        cost:220,  tag:'POWER I',   desc:'+3% постійної швидкості флоту.' },
    { id:'navcore2',   name:'NAV CORE II',     cost:500,  tag:'POWER II',  desc:'Ще +3% постійної швидкості.', requires:'navcore' },
    { id:'navcore3',   name:'NAV CORE III',    cost:1000, tag:'POWER III', desc:'Ще +4% постійної швидкості.', requires:'navcore2' },

    // PROTOCOL POOL — permanent unlock chain.
    { id:'archive1',   name:'ARCHIVE I',   cost:350,  tag:'CONTENT I',  desc:'Відкриває AFTERBURN, NANO FORGE, BULWARK.' },
    { id:'archive2',   name:'ARCHIVE II',  cost:650,  tag:'CONTENT II', desc:'Відкриває PREDATOR, SEED CORE, RIFT MASTER.', requires:'archive1' },
    { id:'archive3',   name:'ARCHIVE III', cost:950,  tag:'CONTENT III',desc:'Відкриває PULSE CORE, SIEGE BREAKER, CHAIN LINK, VOID WALKER, DEEP RESERVE.', requires:'archive2' },
    { id:'doctrine1',  name:'DOCTRINE I',  cost:1350, tag:'BUILD I',    desc:'Відкриває OVERCLOCK, GLASS CANNON, EMERGENCY GRID, SIGNAL JAM, FRONTLINE.', requires:'archive3' },
    { id:'doctrine2',  name:'DOCTRINE II', cost:1800, tag:'BUILD II',   desc:'Відкриває RECLAIMER, GATECRASH, MOMENTUM, FORTRESS.', requires:'doctrine1' },

    // ECONOMY — three visible levels.
    { id:'salvagecore',name:'SALVAGE CORE',    cost:250,  tag:'ECONOMY I',   desc:'+4% Dark Matter при завершенні RUN.' },
    { id:'salvage2',   name:'SALVAGE CORE II', cost:600,  tag:'ECONOMY II',  desc:'Ще +4% Dark Matter при завершенні RUN.', requires:'salvagecore' },
    { id:'salvage3',   name:'SALVAGE CORE III',cost:1200, tag:'ECONOMY III', desc:'Ще +4% Dark Matter при завершенні RUN.', requires:'salvage2' }
]
function metaOwned(id){ return !!metaUnlocks[id]; }
function metaEffects(){
    if(dailyOperationActive) return {start:0,prod:1,speed:1,reward:1};
    return {
        // Permanent meta is intentionally helpful, not run-winning by itself.
        start: (metaOwned('startcache') ? 2 : 0) + (metaOwned('cache2') ? 2 : 0) + (metaOwned('cache3') ? 3 : 0),
        prod: 1 + (metaOwned('reactor') ? .03 : 0) + (metaOwned('reactor2') ? .03 : 0) + (metaOwned('reactor3') ? .04 : 0),
        speed: 1 + (metaOwned('navcore') ? .03 : 0) + (metaOwned('navcore2') ? .03 : 0) + (metaOwned('navcore3') ? .04 : 0),
        reward: 1 + (metaOwned('salvagecore') ? .04 : 0) + (metaOwned('salvage2') ? .04 : 0) + (metaOwned('salvage3') ? .04 : 0)
    };
}
function metaProgressMarkup(){
    const owned=META_NODES.filter(n=>metaOwned(n.id)).length;
    return `<div class="meta-summary"><span>META ${owned}/${META_NODES.length}</span><span>BEST ${String(bestSector).padStart(3,'0')}</span><span>RUNS ${totalRuns}</span></div>`;
}
function metaCategory(n){
    if(n.tag.startsWith('POWER')) return 'power';
    if(n.tag.startsWith('ECONOMY')) return 'economy';
    return 'archives';
}
function metaPreviewText(n){
    const map={
        startcache:['START UNITS','+0','+2'], cache2:['START UNITS','+2','+4'], cache3:['START UNITS','+4','+7'],
        reactor:['PRODUCTION','100%','103%'], reactor2:['PRODUCTION','103%','106%'], reactor3:['PRODUCTION','106%','110%'],
        navcore:['FLEET SPEED','100%','103%'], navcore2:['FLEET SPEED','103%','106%'], navcore3:['FLEET SPEED','106%','110%'],
        salvagecore:['RUN DM BONUS','+0%','+4%'], salvage2:['RUN DM BONUS','+4%','+8%'], salvage3:['RUN DM BONUS','+8%','+12%'],
        archive1:['PROTOCOL POOL','BASE','+3 RARE'], archive2:['PROTOCOL POOL','+3 RARE','+6 RARE'], archive3:['PROTOCOL POOL','+6 RARE','+11 RARE'],
        doctrine1:['BUILD OPTIONS','RARE','EPIC I'], doctrine2:['BUILD OPTIONS','EPIC I','EPIC II']
    };
    return map[n.id]||['UPGRADE','CURRENT','UNLOCKED'];
}
function metaDetailMarkup(n){
    if(!n) return '';
    const owned=metaOwned(n.id), blocked=n.requires && !metaOwned(n.requires), [label,before,after]=metaPreviewText(n);
    const canBuy=!owned&&!blocked&&darkMatter>=n.cost;
    const action=owned?'OWNED':blocked?`ПОТРІБНО: ${META_NODES.find(x=>x.id===n.requires)?.name||n.requires}`:canBuy?`КУПИТИ // ${n.cost} ✦`:`НЕ ВИСТАЧАЄ ${Math.max(0,n.cost-darkMatter)} ✦`;
    return `<section class="choice-focus meta-focus sim-focus">
      <div class="choice-focus-head"><span class="choice-icon">+</span><div><small>${n.tag}</small><h2>${n.name}</h2></div><span class="choice-price">${owned?'✓':`${n.cost} ✦`}</span></div>
      <p class="choice-desc">${n.desc}</p>
      <div class="sim-stage-wrap"><canvas class="sim-stage" data-sim-meta="${n.id}" aria-label="Upgrade effect preview"></canvas><span class="sim-live-badge">${label}</span></div>
      <button class="choice-primary meta-confirm" data-meta-confirm="${n.id}" ${owned||blocked||!canBuy?'disabled':''}>${action}</button>
    </section>`;
}
function renderMetaPanel(showShop=false){
    const panel=document.getElementById('metaPanel'); if(!panel) return;
    if(!showShop || protocolChoicePending){ panel.innerHTML=''; panel.classList.remove('open'); return; }
    panel.classList.add('open');
    const tabs=[['power','POWER'],['archives','ARCHIVES'],['economy','ECONOMY']];
    const visible=META_NODES.filter(n=>metaCategory(n)===metaTab);
    if(!visible.some(n=>n.id===metaPreviewSelection)) metaPreviewSelection=visible.find(n=>!metaOwned(n.id))?.id || visible[0]?.id || '';
    const selected=visible.find(n=>n.id===metaPreviewSelection)||visible[0];
    const cards=visible.map(n=>{const owned=metaOwned(n.id),blocked=n.requires&&!metaOwned(n.requires);return `<button class="simple-list-item ${owned?'owned':''} ${blocked?'blocked':''} ${n.id===selected?.id?'selected':''}" data-meta-preview="${n.id}"><span><b>${n.name}</b><small>${n.tag}</small></span><strong>${owned?'✓':blocked?'LOCK':`${n.cost} ✦`}</strong></button>`;}).join('');
    panel.innerHTML=`<div class="panel-topline"><div><small>PERMANENT PROGRESSION</small><b>META CORE</b></div><strong>✦ ${darkMatter}</strong></div>
      <div class="segmented-tabs">${tabs.map(([id,label])=>`<button class="${metaTab===id?'active':''}" data-meta-tab="${id}">${label}</button>`).join('')}</div>
      ${metaDetailMarkup(selected)}
      <div class="list-caption">ІНШІ АПГРЕЙДИ</div><div class="simple-list">${cards}</div>`;
    const metaSim=panel.querySelector('[data-sim-meta]');
    if(metaSim&&selected&&window.SimPreview){ const [label,before,after]=metaPreviewText(selected); window.SimPreview.meta(metaSim,selected.id,{label,before,after}); }
    panel.querySelectorAll('[data-meta-tab]').forEach(btn=>btn.addEventListener('click',()=>{metaTab=btn.dataset.metaTab;metaPreviewSelection='';renderMetaPanel(true);window.PolishFX?.event('select');}));
    panel.querySelectorAll('[data-meta-preview]').forEach(btn=>btn.addEventListener('click',()=>{metaPreviewSelection=btn.dataset.metaPreview;renderMetaPanel(true);window.PolishFX?.event('select');}));
    panel.querySelectorAll('[data-meta-confirm]').forEach(btn=>btn.addEventListener('click',()=>buyMetaUnlock(btn.dataset.metaConfirm)));
}
function buyMetaUnlock(id){
    if(runStarted && !runEnded) return;
    const n=META_NODES.find(x=>x.id===id); if(!n || metaOwned(id)) return;
    if(n.requires && !metaOwned(n.requires)) return;
    if(darkMatter<n.cost) return;
    darkMatter-=n.cost; metaUnlocks[id]=true; telemetryTrack('meta_purchase',{upgrade:id,cost:n.cost,category:metaCategory(n),dm_after:darkMatter}); saveProgress(); updateShopUI(); renderMetaPanel(true);
}
function nextAffordableUnlock(){
    return META_NODES.find(n=>!metaOwned(n.id) && (!n.requires || metaOwned(n.requires)) && darkMatter>=n.cost) || null;
}
function bankRunPayout(){
    if(runPayoutBanked) return 0;
    if(dailyOperationActive){
        const elapsed=Math.max(0,Date.now()-(dailyOperationStartedAt||Date.now()));
        const result=registerDailyResult(runSectorsCleared,elapsed);
        runPayoutBanked=true;
        saveProgress();
        return result.reward;
    }
    const bonus=Math.max(0, Math.floor(runMatter * (metaEffects().reward-1)));
    const payout=Math.floor(runMatter + bonus);
    darkMatter += payout;
    totalRuns += 1;
    lifetimeSectors += runSectorsCleared;
    lifetimeCaptured += runCaptured;
    if(runSectorsCleared>=RUN_LENGTH) completedRuns += 1;
    bestSector = Math.max(bestSector, currentLevel);
    runPayoutBanked = true;
    syncRetentionRewards();
    saveProgress();
    return payout;
}

const THEMES = [
    { color:'#ffffff', req:1, id:'classic' },
    { color:'#78ffad', req:1, id:'phosphor' },
    { color:'#ffb347', req:1, id:'amber' },
    { color:'#9bbcff', req:1, id:'void' },
    { color:'#ff62d7', req:1, id:'glitch' }
];
let currentThemeIdx = 0;

function applyThemeColor() {
    let MAIN_C = THEMES[currentThemeIdx].color;
    try { document.body.dataset.signalStyle = window.CosmeticsSystem?.getEquipped?.('style') || THEMES[currentThemeIdx].id || 'classic'; } catch(e){}
    document.body.style.color = MAIN_C;
    document.body.style.setProperty('--signal-color', MAIN_C);
    canvas.style.filter = `drop-shadow(0px 0px 4px ${MAIN_C}80)`;
    
    document.querySelectorAll('.upgrade-card, .upg-btn, .ad-btn, .main-btn, .modal-content, .close-btn, .theme-btn, .shop-footer, #gameHUD, .shop-currency').forEach(el => {
        el.style.borderColor = MAIN_C; el.style.color = MAIN_C;
    });

    for (let i = 0; i < THEMES.length; i++) {
        let btn = document.getElementById('theme' + i);
        if (!btn) continue;
        if (currentLevel >= THEMES[i].req) { btn.classList.remove('locked'); btn.innerText = ""; } else { btn.classList.add('locked'); }
        btn.classList.toggle('active', i === currentThemeIdx);
    }
}
window.setTheme = function(idx) { if (THEMES[idx]) { currentThemeIdx = idx; saveProgress(); applyThemeColor(); } }

let typeIntervals = {};
function typeText(id, text, speed) {
    let el = document.getElementById(id); if (!el) return;
    el.textContent = ""; let i = 0;
    if(typeIntervals[id]) clearInterval(typeIntervals[id]);
    typeIntervals[id] = setInterval(() => {
        el.textContent += text.charAt(i); i++;
        if(i >= text.length) clearInterval(typeIntervals[id]);
    }, speed);
}

const UPGRADE_INFO = {
    speed: { title: "[ ДВИГУНИ ]", desc: "Збільшує швидкість польоту кораблів." },
    capacity: { title: "[ АНГАР ]", desc: "Підвищує ліміт юнітів на базах." },
    prod: { title: "[ ВЕРФІ ]", desc: "Прискорює генерацію юнітів." },
    armor: { title: "[ БРОНЯ ]", desc: "Бази втрачають менше юнітів при захисті." },
    start: { title: "[ ДЕСАНТ ]", desc: "Додає стартові юніти на початку." },
    yield: { title: "[ КОНВЕРТОР ]", desc: "Більше Темної Матерії ✦ після бою." }
};
window.showInfo = function(type) {
    if(document.getElementById('infoModal')) document.getElementById('infoModal').style.display = 'flex';
    typeText('infoTitle', UPGRADE_INFO[type].title, 30);
    typeText('infoDesc', UPGRADE_INFO[type].desc, 15);
}
window.closeInfo = function() { if(document.getElementById('infoModal')) document.getElementById('infoModal').style.display = 'none'; }

function saveProgress() {
    let preservedCosmetics=null;
    try { preservedCosmetics=window.CosmeticsSystem?.exportState?.() || JSON.parse(localStorage.getItem('1BitSave')||'null')?.cosmetics || null; } catch(e){}
    const saveData = { version: '5.9.23', savedAt: Date.now(), level: currentLevel, dm: darkMatter, postRunShopPending, selectedThreatLevel, runThreatLevel, maxThreatUnlocked, lastThreatUnlock, dailyOperationActive, dailyOperationKey, dailyOperationStartedAt, dailyOperationBestKey, dailyOperationBestSector, dailyOperationBestTimeMs, dailyOperationAttempts, dailyOperationClaimedReward, dailyOperationLastSector, dailyOperationLastTimeMs, dailyOperationLastReward, dailyOperationRival, dailyOperationReturnRunNumber, dailyOperationReturnRunSeed, dailyOperationReturnSelectedThreat, dailyOperationReturnPostRunShop, dailyGameplayRngState, spd: upgSpeed, cap: upgCapacity, prd: upgProd, arm: upgArmor, str: upgStart, yld: upgYield, theme: currentThemeIdx, runSeed, runNumber, runSectorsCleared, runStarted, runEnded, runMatter, runCaptured, runPayoutBanked, bestSector, totalRuns, lifetimeSectors, lifetimeCaptured, metaUnlocks, activeProtocols, protocolChoicePending, protocolChoiceLevel, awaitingNextSector, continueUsed, runAwaitingDecision, reviveBoostPending, lastRunPayout, doublePayoutAvailable, doublePayoutClaimed, protocolRerollNonce, protocolRerollUsedLevel, protocolPaidRerollUsedLevel, protocolBoostedRerollLevel, achievementUnlocks, milestoneClaims, dailyState, dailyLastClaimKey, dailyStreak, totalBosses, totalEventsCleared, totalProtocolsChosen, completedRuns, cosmetics: preservedCosmetics };
    let str = JSON.stringify(saveData);
    try { localStorage.setItem('1BitSave', str); } catch(e){}
    // PlayDeck setData has a 10 KB value limit. Current full save is ~3 KB,
    // but keep a hard guard so future content cannot silently break cloud sync.
    let cloudBytes=0; try{ cloudBytes=new TextEncoder().encode(str).length; }catch(e){ cloudBytes=str.length; }
    if(pdParent!==window && window.__playdeckCloudReady===true && cloudBytes<=9800){
        try { pdParent.postMessage({ playdeck: { method: 'setData', key: 'playerSave', value: str } }, '*'); } catch(e){}
    } else if(pdParent!==window && cloudBytes>9800){
        try{ telemetryTrack('cloud_save_oversize',{bytes:cloudBytes}); }catch(e){}
    }
}
function loadProgress() {
    let dataStr = null;
    try { dataStr = localStorage.getItem('1BitSave'); } catch(e){}
    if (dataStr) {
        try {
            const d = JSON.parse(dataStr); currentLevel = d.level || 1; darkMatter = d.dm || 0;
            runSeed = Number.isFinite(d.runSeed) ? d.runSeed : 0; selectedThreatLevel=Math.max(0,Math.min(MAX_THREAT_LEVEL,Number(d.selectedThreatLevel)||0)); runThreatLevel=Math.max(0,Math.min(MAX_THREAT_LEVEL,Number(d.runThreatLevel)||0)); maxThreatUnlocked=Math.max(0,Math.min(MAX_THREAT_LEVEL,Number(d.maxThreatUnlocked)||0)); lastThreatUnlock=Math.max(0,Math.min(MAX_THREAT_LEVEL,Number(d.lastThreatUnlock)||0)); if(selectedThreatLevel>maxThreatUnlocked) selectedThreatLevel=maxThreatUnlocked; runNumber = d.runNumber || 1; runSectorsCleared = d.runSectorsCleared || 0; runStarted = !!d.runStarted; runEnded = !!d.runEnded; postRunShopPending = !!d.postRunShopPending; runMatter = d.runMatter || 0; runCaptured = d.runCaptured || 0; runPayoutBanked = !!d.runPayoutBanked; bestSector = d.bestSector || 0; totalRuns = d.totalRuns || 0; lifetimeSectors = d.lifetimeSectors || 0; lifetimeCaptured = d.lifetimeCaptured || 0; metaUnlocks = (d.metaUnlocks && typeof d.metaUnlocks === 'object') ? d.metaUnlocks : {}; activeProtocols = (d.activeProtocols && typeof d.activeProtocols === 'object') ? d.activeProtocols : {}; protocolChoicePending = !!d.protocolChoicePending; protocolChoiceLevel = d.protocolChoiceLevel || 0; awaitingNextSector = !!d.awaitingNextSector; continueUsed=!!d.continueUsed; runAwaitingDecision=!!d.runAwaitingDecision; reviveBoostPending=!!d.reviveBoostPending; lastRunPayout=d.lastRunPayout||0; doublePayoutAvailable=!!d.doublePayoutAvailable; doublePayoutClaimed=!!d.doublePayoutClaimed; protocolRerollNonce=d.protocolRerollNonce||0; protocolRerollUsedLevel=d.protocolRerollUsedLevel||0; protocolPaidRerollUsedLevel=d.protocolPaidRerollUsedLevel||0; protocolBoostedRerollLevel=d.protocolBoostedRerollLevel||0; achievementUnlocks=(d.achievementUnlocks&&typeof d.achievementUnlocks==='object')?d.achievementUnlocks:{}; milestoneClaims=(d.milestoneClaims&&typeof d.milestoneClaims==='object')?d.milestoneClaims:{}; dailyState=(d.dailyState&&typeof d.dailyState==='object')?d.dailyState:{key:'',progress:0,claimed:false}; dailyLastClaimKey=d.dailyLastClaimKey||''; dailyStreak=d.dailyStreak||0; totalBosses=d.totalBosses||0; totalEventsCleared=d.totalEventsCleared||0; totalProtocolsChosen=d.totalProtocolsChosen||0; completedRuns=d.completedRuns||0;
            dailyOperationActive=!!d.dailyOperationActive; dailyOperationKey=d.dailyOperationKey||''; dailyOperationStartedAt=Number(d.dailyOperationStartedAt)||0; dailyOperationBestKey=d.dailyOperationBestKey||''; dailyOperationBestSector=Math.max(0,Number(d.dailyOperationBestSector)||0); dailyOperationBestTimeMs=Math.max(0,Number(d.dailyOperationBestTimeMs)||0); dailyOperationAttempts=Math.max(0,Number(d.dailyOperationAttempts)||0); dailyOperationClaimedReward=Math.max(0,Number(d.dailyOperationClaimedReward)||0); dailyOperationLastSector=Math.max(0,Number(d.dailyOperationLastSector)||0); dailyOperationLastTimeMs=Math.max(0,Number(d.dailyOperationLastTimeMs)||0); dailyOperationLastReward=Math.max(0,Number(d.dailyOperationLastReward)||0); dailyOperationRival=(d.dailyOperationRival&&typeof d.dailyOperationRival==='object')?d.dailyOperationRival:null; dailyOperationReturnRunNumber=Math.max(0,Number(d.dailyOperationReturnRunNumber)||0); dailyOperationReturnRunSeed=Number(d.dailyOperationReturnRunSeed)||0; dailyOperationReturnSelectedThreat=Math.max(0,Number(d.dailyOperationReturnSelectedThreat)||0); dailyOperationReturnPostRunShop=!!d.dailyOperationReturnPostRunShop; dailyGameplayRngState=(Number(d.dailyGameplayRngState)||0)>>>0;
            if(dailyOperationActive && dailyOperationKey && dailyOperationKey!==dailyUtcKey()){ dailyOperationActive=false; dailyOperationStartedAt=0; restoreNormalRunAfterDaily(); }
            else if(dailyOperationActive && !dailyGameplayRngState){ resetDailyGameplayRng(runSeed||dailySeedForKey(dailyOperationKey)); }
            dailyOperationInfo();
            if(d.maxThreatUnlocked==null && completedRuns>0){ maxThreatUnlocked=1; selectedThreatLevel=Math.max(selectedThreatLevel,1); }
            upgSpeed = d.spd || 1; upgCapacity = d.cap || 1; upgProd = d.prd || 1; upgArmor = d.arm || 1; upgStart = d.str || 1; upgYield = d.yld || 1; currentThemeIdx = d.theme || 0;
            // Migration from 5.4.2: that build prepared a fresh idle run after a finished run.
            // Such saves have a generated seed, RUN > 1, no active run, and sector progress reset to zero.
            if (!runStarted && !runAwaitingDecision && !protocolChoicePending && !awaitingNextSector && (postRunShopPending || totalRuns > 0 || runNumber > 1)) postRunShopPending = true;
        } catch(e){}
    }
    applyThemeColor();
}
loadProgress();

let nodes = []; let units = []; let particles = []; let blackHoles = []; 
let asteroids = []; let wormholes = []; let floatingTexts = []; let lasers = [];
let stars = []; let celestialBodies = []; let selectedNodes = []; let isDragging = false;
let currentX = 0, currentY = 0; let gameState = 'playing'; let screenShake = 0;
let tapSource = null; let gestureStartX = 0, gestureStartY = 0; let gestureNode = null; let gestureMoved = false;

function initStars() {
    stars = []; celestialBodies = [];
    for (let i = 0; i < 70; i++) stars.push({ x: Math.random() * window.innerWidth, y: Math.random() * window.innerHeight, speed: Math.random() * 0.5 + 0.1, size: Math.random() > 0.8 ? 2 : 1 });
    for (let i = 0; i < 3; i++) celestialBodies.push({ x: Math.random() * window.innerWidth, y: Math.random() * window.innerHeight, r: 30 + Math.random() * 50, speed: 0.05 + Math.random() * 0.05 });
}

const RUN_ARCHETYPES = [
    { id: 1, key: 'OPEN',       label: 'OPEN FIELD' },
    { id: 2, key: 'BARRIER',    label: 'BARRIER' },
    { id: 3, key: 'SPLIT',      label: 'SPLIT ROUTE' },
    { id: 4, key: 'CHAOS',      label: 'CHAOS' },
    { id: 5, key: 'CROSSROADS', label: 'CROSSROADS' },
    { id: 6, key: 'RING',       label: 'RING' },
    { id: 7, key: 'AMBUSH',     label: 'AMBUSH' },
    { id: 8, key: 'PHASE',      label: 'PHASE GATE' }
];

function seededRng(seed) {
    let a = (Math.floor(seed) >>> 0) || 0x6D2B79F5;
    return function() {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}


// V3.1 BOSSES / EVENTS / ANOMALIES ---------------------------------------
const SECTOR_EVENTS = [
    {id:'ion', name:'ION SURGE', icon:'++', desc:'Усі верфі працюють швидше. Ризик і нагорода зростають.', prodPlayer:1.30, prodEnemy:1.30, reward:1.14},
    {id:'rift', name:'RIFT BLOOM', icon:'@@', desc:'У секторі відкрився додатковий нестабільний портал.', extraRifts:1, reward:1.12},
    {id:'debris', name:'DEBRIS STORM', icon:'##', desc:'Маршрути перекриті додатковими полями уламків.', extraAsteroids:2, reward:1.14},
    {id:'hunter', name:'HUNTER SIGNAL', icon:'!!', desc:'Ворог агресивніший і швидше виробляє флот.', prodEnemy:1.25, aggression:0.16, reward:1.24},
    {id:'cache', name:'ABANDONED CACHE', icon:'+$', desc:'Нейтральні вузли ослаблені. Шанс швидко розігнати економіку.', neutralMult:0.72, captureBoost:5, reward:1.08},
    {id:'gravity', name:'GRAVITY TIDE', icon:'~~', desc:'Флоти рухаються повільніше, маршрути стають важливішими.', speedPlayer:0.84, speedEnemy:0.84, reward:1.16}
];
function getSectorEvent(level){
    if(level % 8 === 0){
        const tier=Math.min(5, Math.max(1, Math.floor(level/8)));
        const bossDesc=[
            '',
            'Перший сторож RUN. Посилена столиця і турелі.',
            'Командний вузол адаптувався. Більше резерву й вогню.',
            'WARDEN контролює сектор через небезпечні маршрути та щільну оборону.',
            'Глибокий командний сектор. Сильний production, турелі та більше hazards.',
            'Фінальний WARDEN RUN. Максимальний резерв, тиск і небезпечна арена.'
        ];
        const tc=threatConfig();
        return {id:'boss'+tier, kind:'boss', bossTier:tier, name:`WARDEN // TIER ${tier}`, icon:'<>',
            desc:bossDesc[tier],
            prodEnemy:(1.16 + tier*0.105) * (runThreatLevel>=3?1.10:1), aggression:0.08 + tier*0.035 + tc.botAggro, reward:(1.32 + tier*0.14) * tc.reward,
            extraAsteroids:(tier===1?1:(tier<=3?2:3))+tc.bossHazards, extraBlackHoles:(tier>=2?Math.min(2,tier-1):0)+(runThreatLevel>=3?1:0), extraRifts:(tier>=4?2:(tier>=2?1:0))+(runThreatLevel>=3?1:0)};
    }
    if(level <= 2) return {id:'none', kind:'normal', name:'', reward:1};
    const rng=seededRng(((runSeed||1) ^ Math.imul(level+313,0x9E3779B1) ^ 0x31B055)>>>0);
    const act=Math.min(5,Math.floor((level-1)/8)+1);
    const chance=Math.min(.92, ([0,.42,.50,.57,.63,.68][act] || .50) + threatConfig().eventBonus);
    if(rng()>chance) return {id:'none', kind:'normal', name:'', reward:1};
    const e=SECTOR_EVENTS[Math.floor(rng()*SECTOR_EVENTS.length)];
    return {...e, kind:'event'};
}
function sectorEventValue(key, fallback=1){
    if(!currentSectorEvent) return fallback;
    const v=currentSectorEvent[key]; return Number.isFinite(v)?v:fallback;
}
function updateSectorAlert(){
    const el=document.getElementById('sectorAlert'); if(!el) return;
    if(sectorAlertTimer){ clearTimeout(sectorAlertTimer); sectorAlertTimer=null; }
    const e=currentSectorEvent;
    const bots=window.currentLevelConfig?.botCount||1;
    const ffa=bots>=2 ? `FREE-FOR-ALL // ${bots+1} FACTIONS` : '';
    if(!e || e.id==='none'){
        if(ffa){ el.className='sector-alert show event'; el.innerHTML=`<b>>< ${ffa}</b><span>Кожна фракція воює сама за себе.</span>`; }
        else { el.className='sector-alert'; el.innerHTML=''; return; }
    } else {
        el.className='sector-alert show '+(e.kind==='boss'?'boss':'event');
        el.innerHTML=`<b>${e.icon||'//'} ${e.name}${ffa?` // ${ffa}`:''}</b><span>${e.desc||''}${ffa?' Кожна фракція воює сама за себе.':''}</span>`;
    }
    // Sector mutation / event text is a temporary introduction, not permanent HUD.
    const duration=(e?.kind==='boss')?3600:2800;
    sectorAlertTimer=setTimeout(()=>{
        el.classList.remove('show','boss','event'); el.innerHTML=''; sectorAlertTimer=null;
    },duration);
}

function generateRunPlan(seed) {
    const rng = seededRng((seed >>> 0) ^ 0x51F15EED);
    const plan = []; let previous = -1;
    for (let i = 0; i < RUN_LENGTH; i++) {
        let id = 1 + Math.floor(rng() * RUN_ARCHETYPES.length);
        if (id === previous) id = (id % RUN_ARCHETYPES.length) + 1;
        previous = id;
        const def = RUN_ARCHETYPES.find(a => a.id === id);
        const personalityPool=['expansionist','balanced','aggressive','tactician'];
        const p1=personalityPool[Math.floor(rng()*personalityPool.length)];
        let p2=personalityPool[Math.floor(rng()*personalityPool.length)];
        if(p2===p1) p2=personalityPool[(personalityPool.indexOf(p1)+1+Math.floor(rng()*(personalityPool.length-1)))%personalityPool.length];
        let p3=personalityPool[Math.floor(rng()*personalityPool.length)];
        if(p3===p1||p3===p2) p3=personalityPool.find(x=>x!==p1&&x!==p2)||'balanced';
        plan.push({sector:i+1, archetype:id, key:def.key, label:def.label,
            variant:1+Math.floor(rng()*4), mirrorX:rng()>.5,
            drift:Math.floor(rng()*100000), personality:p1,
            botPersonalities:{2:p1,3:p2,4:p3}});
    }
    return plan;
}

function getRunSectorSpec(lvlNum) {
    const seed = runSeed || 1;
    const plan = generateRunPlan(seed);
    return plan[Math.max(0, Math.min(plan.length - 1, lvlNum - 1))];
}

function runPlanMarkup(seed) {
    const act = Math.min(5, Math.floor((Math.max(1,currentLevel)-1)/8)+1);
    return `<div class="run-hint">ACT ${act}/5 // ПРОГРЕС ${runSectorsCleared}/${RUN_LENGTH}</div>`;
}

function generateProceduralLevel(lvlNum) {
    // V2.6: the run seed now chooses the actual sector archetype sequence,
    // each archetype variant, mirroring and all local placement jitter.
    const spec = getRunSectorSpec(lvlNum);
    const sectorEvent = getSectorEvent(lvlNum);
    const mapSeed = ((runSeed >>> 0) ^ Math.imul(lvlNum + 17, 2654435761) ^ Math.imul(spec.drift + spec.variant, 1597334677)) >>> 0;
    const rng = seededRng(mapSeed);

    const W = window.innerWidth, H = window.innerHeight;
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const jitter = (amount) => (rng() - 0.5) * amount;
    const mirror = spec.mirrorX;
    const P = (x, y) => ({ x: W * (mirror ? 1 - x : x), y: H * y });

    const personality = spec.personality;
    const act = Math.min(5, Math.floor((lvlNum-1)/8)+1);
    const diff = runDifficultyCurve(lvlNum);
    // V4.1 MULTI-BOT FFA. Boss sectors stay authored 1v1 milestones.
    // ACT I-II: 1 bot. ACT III: occasional 2 bots. ACT IV-V: 2 bots by default.
    // Deep ACT V has a rare 3-bot free-for-all (player + 3 AI = 4 factions total).
    let botCount=1;
    if(sectorEvent.kind!=='boss'){
        const tc=threatConfig();
        if(act===2 && tc.act2Ffa>0) botCount = rng()<tc.act2Ffa ? 2 : 1;
        else if(act===3) botCount = rng()<tc.act3Ffa ? 2 : 1;
        else if(act>=4) botCount = 2;
        if(act===5 && lvlNum>=34 && rng()<tc.ffa4) botCount=3;
    }
    const botPersonalities = spec.botPersonalities || {2:personality,3:'tactician',4:'aggressive'};
    const baseR = Math.max(25, Math.min(30, W * 0.073));
    const baseU = 34 + Math.min(10, lvlNum - 1) * 1.6;
    const neutralR = Math.max(17, Math.min(21, W * 0.050));

    let generatedObjects = [], outNodes = [], outBlackHoles = [], outAsteroids = [], outWormholes = [];

    function validPoint(x, y, radius, gap=18) {
        if (x < 36 || x > W - 36 || y < 105 || y > H - 128) return false;
        for (const o of generatedObjects) {
            if (Math.hypot(x-o.x, y-o.y) < radius + o.radius + gap) return false;
        }
        return true;
    }
    function placeAt(x, y, radius, gap=18, spread=0) {
        for (let k=0;k<120;k++) {
            const xx = clamp(x + jitter(spread), 40, W-40);
            const yy = clamp(y + jitter(spread*1.15), 108, H-134);
            if (validPoint(xx, yy, radius, gap)) return {x:xx,y:yy};
        }
        return null;
    }
    function placeNorm(x, y, radius, gap=18, spread=0.04) {
        const q=P(x,y); return placeAt(q.x,q.y,radius,gap,W*spread);
    }
    function placeFree(radius, gap=18) {
        for (let k=0;k<600;k++) {
            const x = W * (0.11 + rng()*0.78);
            const y = H * (0.19 + rng()*0.62);
            if (validPoint(x,y,radius,gap)) return {x,y};
        }
        return null;
    }
    function reserve(p, radius) { generatedObjects.push({x:p.x,y:p.y,radius}); }

    function addNode(owner, id, anchor, units, type=0, capital=false) {
        const r = capital ? baseR : neutralR;
        let p = placeNorm(anchor[0],anchor[1],r, capital?34:20, capital?0.025:0.045) || placeFree(r,capital?34:20);
        if (!p) return null;
        const n = new Node(id,p.x,p.y,r,owner,units,type,capital);
        outNodes.push(n); reserve(p,r+8); return n;
    }
    function addOutpostNear(capital, owner, id, index, act) {
        if(!capital) return null;
        const r = Math.max(13, neutralR * .78);
        const baseDist = baseR + r + 24 + index*10;
        // Seeded angles keep outposts near their own capital but prevent identical formations.
        const sideBias = owner===1 ? -Math.PI/2 : Math.PI/2;
        const startA = sideBias + (rng()-.5)*1.35 + (index?Math.PI*.78:0);
        let p=null;
        for(let k=0;k<24;k++){
            const a=startA + (k%2?1:-1)*Math.ceil(k/2)*.22;
            const dist=baseDist + (k%3)*7;
            const x=clamp(capital.x+Math.cos(a)*dist,40,W-40);
            const y=clamp(capital.y+Math.sin(a)*dist,108,H-134);
            if(validPoint(x,y,r,12)){ p={x,y}; break; }
        }
        if(!p) return null;
        const startUnits = Math.floor(10 + act*2 + rng()*5 + (owner===1 ? 0 : diff.enemyOutpost));
        const type = act>=4 && index===1 ? 1 : 0;
        const n=new Node(id,p.x,p.y,r,owner,startUnits,type,false);
        n.isOutpost=true;
        outNodes.push(n); reserve(p,r+7); return n;
    }
    function addExtraBotCapital(owner, id, unitBias=0) {
        const existingCaps=outNodes.filter(n=>n.isCapital);
        const candidates=[
            [.18,.22],[.82,.22],[.18,.48],[.82,.48],[.28,.30],[.72,.30],
            [.18,.66],[.82,.66],[.36,.20],[.64,.20],[.36,.54],[.64,.54]
        ];
        let best=null, bestScore=-Infinity;
        for(const a of candidates){
            const q=P(a[0],a[1]);
            if(q.y>H*.69) continue; // Keep AI capitals mostly away from the player's lower territory.
            let minD=Infinity;
            existingCaps.forEach(c=>{minD=Math.min(minD,Math.hypot(q.x-c.x,q.y-c.y));});
            const centerPenalty=Math.abs(q.x-W*.5)*.05;
            const score=minD+centerPenalty+jitter(8);
            if(score>bestScore && validPoint(q.x,q.y,baseR,30)){bestScore=score;best=a;}
        }
        if(!best){
            for(const a of candidates){ const q=P(a[0],a[1]); if(validPoint(q.x,q.y,baseR,28)){best=a;break;} }
        }
        if(!best) return null;
        const units=Math.floor(baseU + Math.max(0,lvlNum-2) + diff.enemyStart + unitBias + rng()*5);
        return addNode(owner,id,best,units,(lvlNum+owner)%3,true);
    }

    function addAsteroid(x,y,scale=1) {
        const r = Math.max(34, Math.min(45, W * 0.105)) * scale;
        const p = placeNorm(x,y,r,13,0.035) || placeFree(r,13);
        if (p) { outAsteroids.push(new AsteroidField(p.x,p.y,r,rng)); reserve(p,r+16); }
    }
    function addBlackHole(x,y,scale=1) {
        const r = Math.max(24, Math.min(31, W * 0.074)) * scale;
        const p = placeNorm(x,y,r,16,0.03) || placeFree(r,16);
        if (p) { outBlackHoles.push(new BlackHole(p.x,p.y,r)); reserve(p,r+22); }
    }
    function addWormholes(a,b) {
        const p1 = placeNorm(a[0],a[1],24,14,0.025) || placeFree(24,14);
        if (!p1) return; reserve(p1,40);
        const p2 = placeNorm(b[0],b[1],24,14,0.025) || placeFree(24,14);
        if (!p2) return;
        const w1=new Wormhole(p1.x,p1.y), w2=new Wormhole(p2.x,p2.y);
        w1.twin=w2; w2.twin=w1; outWormholes.push(w1,w2); reserve(p2,40);
    }

    const CAPITALS = {
        1: [ [[.50,.82],[.50,.18]], [[.22,.76],[.78,.24]], [[.76,.78],[.24,.22]], [[.34,.82],[.72,.19]] ],
        2: [ [[.18,.74],[.82,.26]], [[.72,.80],[.28,.20]], [[.50,.82],[.78,.22]], [[.24,.80],[.66,.18]] ],
        3: [ [[.22,.78],[.78,.22]], [[.78,.76],[.22,.24]], [[.50,.82],[.20,.24]], [[.22,.70],[.76,.30]] ],
        4: [ [[.30,.80],[.72,.20]], [[.76,.72],[.24,.28]], [[.18,.70],[.68,.20]], [[.62,.82],[.20,.26]] ],
        5: [ [[.50,.82],[.18,.24]], [[.22,.78],[.76,.20]], [[.78,.76],[.26,.22]], [[.36,.82],[.80,.30]] ],
        6: [ [[.50,.82],[.50,.18]], [[.24,.72],[.76,.28]], [[.74,.78],[.26,.22]], [[.30,.80],[.70,.20]] ],
        7: [ [[.20,.76],[.78,.30]], [[.76,.78],[.24,.22]], [[.46,.82],[.80,.22]], [[.22,.68],[.72,.18]] ],
        8: [ [[.26,.78],[.74,.22]], [[.72,.80],[.28,.20]], [[.50,.82],[.20,.22]], [[.18,.74],[.68,.18]] ]
    };
    const capLayout = CAPITALS[spec.archetype][spec.variant-1];
    const player = addNode(1,1,capLayout[0],baseU, lvlNum%3, true);
    let enemy = addNode(2,2,capLayout[1],baseU + Math.max(0,lvlNum-2) + diff.enemyStart, (lvlNum+1)%3, true);
    // Safety: if a narrow device causes bad placement, force the second base away.
    if (player && enemy && Math.hypot(player.x-enemy.x,player.y-enemy.y) < Math.max(W,H)*0.38) {
        generatedObjects = generatedObjects.filter(o => !(o.x===enemy.x && o.y===enemy.y));
        outNodes = outNodes.filter(n => n !== enemy);
        const fallback = P(capLayout[1][0] > .5 ? .82 : .18, capLayout[1][1] < .5 ? .20 : .78);
        let fp = placeAt(fallback.x,fallback.y,baseR,34,W*.025) || placeFree(baseR,34);
        if(fp){ enemy=new Node(2,fp.x,fp.y,baseR,2,baseU,(lvlNum+1)%3,true); outNodes.push(enemy); reserve(fp,baseR+8); }
    }

    const botCapitals={2:enemy};
    if(botCount>=2){
        const b3=addExtraBotCapital(3,3,2); if(b3) botCapitals[3]=b3;
    }
    if(botCount>=3){
        const b4=addExtraBotCapital(4,4,4); if(b4) botCapitals[4]=b4;
    }
    const actualBotCount=Object.keys(botCapitals).filter(k=>botCapitals[k]).length;

    // Milestone boss sectors: 8 / 16 / 24 / 32 / 40.
    if (sectorEvent.kind === 'boss' && enemy) {
        const tier = sectorEvent.bossTier || 1;
        enemy.isBoss = true; enemy.bossTier = tier; enemy.type = 2;
        enemy.radius = baseR * (1.14 + tier*0.045);
        enemy.unitsCount = Math.floor((enemy.unitsCount + 26 + tier*21) * diff.bossStart);
    }

    // V4.1 STARTING TERRITORY: every faction can own nearby satellite bases.
    // More factions means each AI gets slightly fewer outposts so the phone screen stays readable.
    let playerOutposts=0;
    if(act===2) playerOutposts=rng()<.48?1:0;
    else if(act===3) playerOutposts=1;
    else if(act===4) playerOutposts=1+(rng()<.48?1:0);
    else if(act>=5) playerOutposts=2;
    if(sectorEvent.kind==='boss' && act>=2) playerOutposts=Math.max(1,playerOutposts);
    for(let i=0;i<playerOutposts;i++) addOutpostNear(player,1,100+i,i,act);

    const botOutposts={};
    Object.entries(botCapitals).forEach(([ownerStr,cap])=>{
        const owner=Number(ownerStr); if(!cap) return;
        let count=0;
        if(act===2) count=rng()<.58?1:0;
        else if(act===3) count=1;
        else if(act===4) count=actualBotCount>=2 ? 1 : 1+(rng()<.58?1:0);
        else if(act>=5) count=actualBotCount>=3 ? 1 : (1+(rng()<.62?1:0));
        if(sectorEvent.kind==='boss' && act>=2) count=Math.max(1,count);
        if(threatConfig().botOutpostBonus && act>=3) count=Math.min(2,count+threatConfig().botOutpostBonus);
        botOutposts[owner]=count;
        for(let i=0;i<count;i++) addOutpostNear(cap,owner,owner*100+i,i,act);
    });

    // Every archetype owns several genuinely different neutral silhouettes.
    const NEUTRALS = {
        1: [
            [[.24,.55],[.50,.42],[.76,.58],[.48,.66]],
            [[.20,.40],[.42,.60],[.68,.38],[.78,.62]],
            [[.30,.30],[.68,.44],[.36,.64],[.72,.70]],
            [[.18,.56],[.40,.34],[.62,.62],[.82,.42]]
        ],
        2: [
            [[.22,.34],[.38,.58],[.62,.42],[.78,.66]],
            [[.28,.64],[.42,.36],[.58,.64],[.72,.36]],
            [[.18,.46],[.36,.30],[.64,.70],[.82,.54]],
            [[.26,.30],[.50,.66],[.74,.34],[.52,.40]]
        ],
        3: [
            [[.18,.42],[.34,.28],[.66,.72],[.82,.56]],
            [[.24,.66],[.38,.44],[.62,.56],[.76,.30]],
            [[.20,.30],[.36,.62],[.64,.38],[.80,.68]],
            [[.28,.38],[.34,.70],[.66,.30],[.74,.60]]
        ],
        4: [
            [[.18,.34],[.34,.62],[.56,.30],[.78,.56],[.48,.72]],
            [[.22,.62],[.40,.26],[.62,.52],[.80,.34],[.50,.68]],
            [[.16,.50],[.38,.36],[.54,.66],[.72,.28],[.82,.62]],
            [[.28,.26],[.20,.64],[.52,.46],[.72,.70],[.82,.36]]
        ],
        5: [
            [[.24,.30],[.50,.48],[.76,.30],[.34,.70],[.68,.68]],
            [[.18,.52],[.40,.32],[.60,.68],[.82,.46],[.52,.48]],
            [[.28,.66],[.48,.30],[.70,.62],[.78,.34],[.24,.40]],
            [[.20,.28],[.38,.54],[.62,.46],[.80,.70],[.54,.72]]
        ],
        6: [
            [[.22,.50],[.34,.28],[.66,.28],[.78,.50],[.62,.72],[.38,.72]],
            [[.24,.36],[.50,.24],[.76,.36],[.72,.66],[.50,.74],[.28,.66]],
            [[.18,.48],[.32,.30],[.56,.26],[.80,.46],[.66,.70],[.40,.72]],
            [[.28,.24],[.68,.30],[.80,.58],[.56,.72],[.22,.62],[.42,.46]]
        ],
        7: [
            [[.18,.28],[.42,.42],[.70,.30],[.28,.68],[.62,.60]],
            [[.22,.62],[.36,.34],[.58,.48],[.80,.68],[.74,.28]],
            [[.18,.48],[.44,.26],[.52,.66],[.76,.52],[.68,.34]],
            [[.24,.30],[.32,.62],[.58,.36],[.74,.70],[.82,.42]]
        ],
        8: [
            [[.18,.56],[.34,.28],[.52,.50],[.70,.30],[.82,.60]],
            [[.20,.34],[.38,.66],[.58,.26],[.78,.50],[.62,.70]],
            [[.26,.26],[.22,.64],[.50,.44],[.72,.70],[.82,.34]],
            [[.18,.46],[.40,.26],[.62,.58],[.78,.28],[.52,.72]]
        ]
    };

    // Obstacles are authored per archetype + variant, with small seeded drift.
    const v = spec.variant;
    switch(spec.archetype) {
        case 1: // OPEN: mostly clean; one side hazard on later run sectors.
            if (lvlNum >= 3) addAsteroid(v%2? .34:.66, .50, .88);
            break;
        case 2: // BARRIER: different barrier orientations.
            if (v===1){ addAsteroid(.42,.49); addAsteroid(.60,.53); }
            if (v===2){ addAsteroid(.50,.42); addAsteroid(.50,.62); }
            if (v===3){ addAsteroid(.36,.42); addAsteroid(.62,.58); }
            if (v===4){ addAsteroid(.36,.58); addAsteroid(.64,.42); }
            break;
        case 3: // SPLIT: a central block forces lane choice.
            if (v%2){ addAsteroid(.50,.47,1.05); addBlackHole(.50,.62,.90); }
            else { addBlackHole(.48,.45,.92); addAsteroid(.52,.61,1.0); }
            break;
        case 4: // CHAOS: deliberately asymmetric.
            addBlackHole(v===1?.34:v===2?.68:v===3?.42:.62, v<=2?.38:.56);
            addAsteroid(v===1?.66:v===2?.32:v===3?.68:.34, v<=2?.60:.34);
            if (v===4) addAsteroid(.54,.68,.82);
            break;
        case 5: // CROSSROADS: danger around the central crossing.
            addAsteroid(.50,.48,.95);
            if(v===1||v===3){ addBlackHole(.28,.56,.84); addBlackHole(.72,.42,.84); }
            else { addBlackHole(.30,.38,.84); addBlackHole(.70,.62,.84); }
            if (lvlNum >= 2) addWormholes(v%2? [.22,.34]:[.24,.66], v%2? [.78,.66]:[.76,.34]);
            break;
        case 6: // RING: center is dangerous, planets orbit it.
            addBlackHole(.50,.50,1.05);
            if(v===2||v===4){ addAsteroid(.32,.50,.78); addAsteroid(.68,.50,.78); }
            break;
        case 7: // AMBUSH: shortest line is bad, one flank is attractive.
            if(v%2){ addBlackHole(.46,.44,.96); addAsteroid(.62,.54,.94); }
            else { addAsteroid(.40,.46,.96); addBlackHole(.58,.56,.94); }
            break;
        case 8: // PHASE: portals are the identity of the map.
            if(v===1) addWormholes([.24,.32],[.76,.68]);
            if(v===2) addWormholes([.22,.62],[.78,.36]);
            if(v===3) addWormholes([.34,.28],[.68,.70]);
            if(v===4) addWormholes([.18,.48],[.82,.54]);
            addAsteroid(v%2? .50:.36, v%2? .50:.52, .90);
            if(v%2===0) addBlackHole(.64,.46,.82);
            break;
    }

    // Sector anomalies add authored pressure without replacing the base archetype.
    if (sectorEvent.extraAsteroids) {
        const pts=[[.28,.46],[.72,.54],[.50,.36],[.50,.66]];
        for(let i=0;i<sectorEvent.extraAsteroids;i++){ const q=pts[(i+spec.variant)%pts.length]; addAsteroid(q[0],q[1],.78); }
    }
    if (sectorEvent.extraBlackHoles) {
        const pts=[[.34,.52],[.66,.48]];
        for(let i=0;i<sectorEvent.extraBlackHoles;i++){ const q=pts[(i+spec.variant)%pts.length]; addBlackHole(q[0],q[1],.78); }
    }
    if (sectorEvent.extraRifts) {
        if(spec.variant%2) addWormholes([.18,.36],[.82,.64]); else addWormholes([.20,.66],[.80,.34]);
    }

    const baseNeutralCount = [0,3,4,4,5,5,5,5,5][spec.archetype] || 4;
    const neutralCount = Math.min(10, baseNeutralCount + (lvlNum >= 4 ? 1 : 0) + (act>=4 ? 1 : 0) + Math.max(0,actualBotCount-1));
    let neutralAnchors = NEUTRALS[spec.archetype][v-1].slice();
    // Seeded rotation of the order means the "first" easy target changes even for same variant.
    const shift = Math.floor(rng()*neutralAnchors.length);
    neutralAnchors = neutralAnchors.slice(shift).concat(neutralAnchors.slice(0,shift));
    for (let i=0;i<neutralCount;i++) {
        const a=neutralAnchors[i % neutralAnchors.length];
        let p=placeNorm(a[0],a[1],neutralR,20,0.04) || placeFree(neutralR,20);
        if(!p) continue;
        const typeRoll = Math.floor(rng()*10);
        const type = typeRoll < 2 ? 2 : (typeRoll < 5 ? 1 : 0);
        const defenders = Math.max(5, Math.floor((11 + lvlNum*2 + Math.floor(rng()*7)) * (sectorEvent.neutralMult || 1) * threatConfig().neutral * diff.neutral));
        const n=new Node(10+i,p.x,p.y,neutralR,0,defenders,type,false);
        outNodes.push(n); reserve(p,neutralR+7);
    }

    return {
        botPersonality: personality,
        botPersonalities,
        botCount: actualBotCount,
        nodes: outNodes,
        blackHoles: outBlackHoles,
        asteroids: outAsteroids,
        wormholes: outWormholes,
        runSpec: spec,
        archetype: spec.key,
        variant: spec.variant,
        sectorEvent,
        runAct:act,
        startingOutposts:{player:playerOutposts,bots:botOutposts}
    };
}

class Particle {
    constructor(x, y) { this.x = x; this.y = y; this.vx = (Math.random() - 0.5) * 5; this.vy = (Math.random() - 0.5) * 5; this.life = 1.0; this.decay = 0.03 + Math.random() * 0.05; }
    update() { this.x += this.vx; this.y += this.vy; this.life -= this.decay; return this.life <= 0; }
    draw() { ctx.globalAlpha = Math.max(0, this.life); ctx.fillStyle = THEMES[currentThemeIdx].color; ctx.fillRect(this.x, this.y, 2, 2); ctx.globalAlpha = 1.0; }
}
class FloatingText {
    constructor(x, y, text) { this.x = x + (Math.random() - 0.5) * 20; this.y = y; this.text = text; this.life = 1.0; this.vy = __perfLite ? -1.25 : -1.5; }
    update() { this.y += this.vy; this.life -= __perfLite ? 0.04 : 0.02; return this.life <= 0; }
    draw() { ctx.globalAlpha = Math.max(0, this.life); ctx.fillStyle = THEMES[currentThemeIdx].color; ctx.font = __perfLite ? "bold 11px monospace" : "bold 14px monospace"; ctx.textAlign = "center"; ctx.fillText(this.text, this.x, this.y); ctx.globalAlpha = 1.0; }
}

class AsteroidField {
    constructor(x, y, r, rng = Math.random) { 
        this.x = x; this.y = y; this.r = r; this.rocks = [];
        let numRocks = 10 + rng() * 5;
        for(let i=0; i<numRocks; i++) {
            let dist = rng() * this.r * 0.8; let ang = rng() * Math.PI * 2;
            let rx = this.x + Math.cos(ang)*dist; let ry = this.y + Math.sin(ang)*dist;
            let pts = []; let pCount = 4 + Math.floor(rng()*3);
            for(let j=0; j<pCount; j++) { let a = (Math.PI*2/pCount)*j; let d = 3 + rng()*5; pts.push({x: Math.cos(a)*d, y: Math.sin(a)*d}); }
            this.rocks.push({x: rx, y: ry, pts: pts});
        }
    }
    draw(MAIN_C, isPlaying) {
        ctx.strokeStyle = MAIN_C; ctx.lineWidth = 1; ctx.globalAlpha = 0.4;
        this.rocks.forEach(r => {
            ctx.beginPath(); r.pts.forEach((p, i) => { if(i===0) ctx.moveTo(r.x + p.x, r.y + p.y); else ctx.lineTo(r.x + p.x, r.y + p.y); });
            ctx.closePath(); ctx.stroke();
        });
        ctx.globalAlpha = 1.0;
    }
}

class Wormhole {
    constructor(x, y) { this.x = x; this.y = y; this.radius = 20; this.angle = 0; this.twin = null; }
    draw(MAIN_C, isPlaying) {
        ctx.save(); ctx.translate(this.x, this.y); 
        if (isPlaying) this.angle -= 0.05; 
        ctx.rotate(this.angle);
        ctx.strokeStyle = MAIN_C; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-15, -15); ctx.lineTo(15, -15); ctx.lineTo(15, 15); ctx.lineTo(-15, 15); ctx.closePath(); ctx.stroke();
        ctx.rotate(Math.PI/4); ctx.beginPath(); ctx.moveTo(-15, -15); ctx.lineTo(15, -15); ctx.lineTo(15, 15); ctx.lineTo(-15, 15); ctx.closePath(); ctx.stroke();
        ctx.restore();
        if (selectedNodes.length > 0 && Math.hypot(this.x - currentX, this.y - currentY) < this.radius + 10) {
            ctx.beginPath(); ctx.arc(this.x, this.y, this.radius + 10, 0, Math.PI * 2); ctx.strokeStyle = MAIN_C; ctx.lineWidth = 1; ctx.setLineDash([5, 5]); ctx.stroke(); ctx.setLineDash([]);
        }
    }
}

class BlackHole {
    constructor(x, y, radius) { this.x = x; this.y = y; this.radius = radius; this.angle = 0; this.suckDots = []; }
    draw(MAIN_C, isPlaying) {
        ctx.save(); ctx.translate(this.x, this.y); 
        if (isPlaying) this.angle -= 0.02;
        
        if(__perfLite){
            ctx.fillStyle='rgba(0,0,0,.92)'; ctx.beginPath(); ctx.arc(0,0,this.radius*.78,0,Math.PI*2); ctx.fill();
            ctx.strokeStyle='rgba(255,255,255,.10)'; ctx.lineWidth=1; ctx.beginPath(); ctx.arc(0,0,this.radius*.92,0,Math.PI*2); ctx.stroke();
        } else {
            let grad = ctx.createRadialGradient(0, 0, 0, 0, 0, this.radius);
            grad.addColorStop(0, '#000'); grad.addColorStop(0.5, 'rgba(0,0,0,0.9)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(0, 0, this.radius, 0, Math.PI*2); ctx.fill();
        }

        ctx.rotate(this.angle);
        ctx.strokeStyle = MAIN_C; ctx.lineWidth = 2; ctx.setLineDash([4, 25]);
        ctx.beginPath(); ctx.arc(0, 0, this.radius, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]); ctx.restore();

        if (isPlaying && Math.random() < 0.6) this.suckDots.push({ d: this.radius, a: Math.random() * Math.PI * 2 });
        ctx.fillStyle = MAIN_C;
        for (let i = this.suckDots.length - 1; i >= 0; i--) {
            let p = this.suckDots[i]; 
            if (isPlaying) { p.d -= 2.0; p.a += 0.1; }
            if (p.d <= 2) { if(isPlaying) this.suckDots.splice(i, 1); continue; }
            ctx.globalAlpha = p.d / this.radius;
            ctx.fillRect(this.x + Math.cos(p.a) * p.d, this.y + Math.sin(p.a) * p.d, 2, 2);
        }
        ctx.globalAlpha = 1.0;
    }
    checkCollision(unitX, unitY) { const dx=this.x-unitX,dy=this.y-unitY,r=this.radius+15; return dx*dx+dy*dy < r*r; }
}

class Node {
    constructor(id, x, y, radius, owner, unitsCount, type = 0, isCapital = false) {
        this.id = id; this.x = x; this.y = y; this.radius = radius; this.owner = owner; 
        this.unitsCount = unitsCount; this.type = type; this.isCapital = isCapital;
        
        this.orbitAngle = Math.random() * Math.PI * 2; 
        this.baseAngle = Math.random() * Math.PI * 2;  
        this.turretAngle = Math.random() * Math.PI * 2; 
        this.laserCooldown = 0; this.pulse = 0;
    }
    
    drawShape(ctx, r, owner) {
        ctx.beginPath();
        if (owner === 1) { ctx.moveTo(0, -r); ctx.lineTo(r*0.866, r*0.5); ctx.lineTo(-r*0.866, r*0.5); } 
        else if (owner === 2) { ctx.moveTo(0, -r); ctx.lineTo(r, 0); ctx.lineTo(0, r); ctx.lineTo(-r, 0); } 
        else if (owner === 3) { let sr = r * 0.8; ctx.rect(-sr, -sr, sr*2, sr*2); } 
        else if (owner === 4) { for (let i = 0; i < 6; i++) { let hx = r * Math.cos(Math.PI / 3 * i); let hy = r * Math.sin(Math.PI / 3 * i); if (i === 0) ctx.moveTo(hx, hy); else ctx.lineTo(hx, hy); } } 
        else { ctx.arc(0, 0, r, 0, Math.PI * 2); } 
        ctx.closePath();
    }

    shootLaser() {
        if (this.owner === 0 || this.laserCooldown > 0) return;
        if (!this.isCapital && this.type !== 2) return; 
        
        let range = this.isCapital ? 150 : 110;
        let dmg = this.isCapital ? 4 : 2;
        let cd = this.isCapital ? 15 : 35;
        if (this.isBoss) { const t=this.bossTier||1; range=170+t*18; dmg=4.5+t*1.35; cd=Math.max(7,14-t*2); }
        if (this.owner === 1) { const pe=__framePE || protocolEffects(); dmg += pe.turretDamage + (this.isCapital ? pe.capitalTurret : 0); cd = Math.max(6, Math.round(cd * pe.turretCooldown)); } 
        let numTurrets = this.isBoss ? 2+(this.bossTier||1) : (this.isCapital ? 2 : 1);
        
        // POINT DEFENSE: Стріляємо ТІЛЬКИ по тих, хто летить атакувати САМЕ ЦЮ БАЗУ
        let target = units.find(u => u.owner !== this.owner && u.target === this && Math.hypot(this.x - u.x, this.y - u.y) < range && !u.suckedBy);
        
        if (target) { 
            let bestDist = Infinity; let shootX = this.x; let shootY = this.y;
            
            for (let i = 0; i < numTurrets; i++) {
                let currentAngle = this.turretAngle + (i * Math.PI); 
                let tx = this.x + Math.cos(currentAngle) * (this.radius + 16);
                let ty = this.y + Math.sin(currentAngle) * (this.radius + 16);
                let distToTarget = Math.hypot(tx - target.x, ty - target.y);
                if (distToTarget < bestDist) { bestDist = distToTarget; shootX = tx; shootY = ty; }
            }

            if(!__perfLite || lasers.length<32) lasers.push({ x1: shootX, y1: shootY, x2: target.x, y2: target.y, life: 1.0 }); 
            target.hp -= dmg; 
            this.laserCooldown = cd; 
        }
    }

    draw(MAIN_C, isPlaying) {
        if (isPlaying) {
            if (this.laserCooldown > 0) this.laserCooldown--; 
            this.shootLaser();
            if (this.pulse > 0) this.pulse -= 0.5; 
            this.baseAngle += 0.015;   
            this.turretAngle += 0.04;  
            this.orbitAngle += 0.015;  
        }

        let r = this.radius + this.pulse; 
        ctx.save(); ctx.translate(this.x, this.y);

        ctx.save();
        ctx.rotate(this.baseAngle);
        this.drawShape(ctx, r, this.owner);
        
        if (this.owner === 1) { ctx.fillStyle = MAIN_C; ctx.fill(); } 
        else if (this.owner === 0) { ctx.strokeStyle = MAIN_C; ctx.lineWidth = 1; ctx.setLineDash([4, 6]); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 0.5; }
        else { ctx.strokeStyle = MAIN_C; ctx.lineWidth = (this.owner === 2) ? 4 : 2; ctx.stroke(); }
        ctx.globalAlpha = 1.0;
        ctx.restore();

        if (this.isCapital || this.type === 2) {
            let numTurrets = this.isBoss ? 2+(this.bossTier||1) : (this.isCapital ? 2 : 1); 
            for (let i = 0; i < numTurrets; i++) {
                let currentAngle = this.turretAngle + (i * Math.PI); 
                let tx = Math.cos(currentAngle) * (r + 16);
                let ty = Math.sin(currentAngle) * (r + 16);
                
                ctx.save();
                ctx.translate(tx, ty);
                ctx.rotate(this.baseAngle * 2); 
                this.drawShape(ctx, r * 0.3, this.owner); 
                
                if (this.owner === 1) { ctx.fillStyle = MAIN_C; ctx.fill(); } 
                else if (this.owner === 0) { ctx.strokeStyle = MAIN_C; ctx.lineWidth = 1; ctx.setLineDash([2, 2]); ctx.stroke(); ctx.setLineDash([]); }
                else { ctx.strokeStyle = MAIN_C; ctx.lineWidth = 2; ctx.stroke(); }
                ctx.restore();
            }
        }

        if (this.isBoss) {
            const t=this.bossTier||1;
            ctx.strokeStyle=MAIN_C; ctx.lineWidth=1; ctx.globalAlpha=.65;
            for(let k=0;k<t+1;k++){ ctx.beginPath(); ctx.arc(0,0,r+11+k*7,0,Math.PI*2); ctx.setLineDash(k%2?[3,5]:[8,5]); ctx.stroke(); }
            ctx.setLineDash([]); ctx.globalAlpha=1;
            ctx.font='bold 9px monospace'; ctx.fillStyle=MAIN_C; ctx.fillText(`WARDEN ${t}`,0,-r-18-(t*6));
        }

        if (selectedNodes.includes(this)) { ctx.beginPath(); ctx.arc(0, 0, r + 25, 0, Math.PI * 2); ctx.strokeStyle = MAIN_C; ctx.lineWidth = 1; ctx.setLineDash([5, 5]); ctx.stroke(); ctx.setLineDash([]); }

        let dotCount = Math.min(20, Math.floor(this.unitsCount / 2));
        ctx.fillStyle = (this.owner === 1) ? MAIN_C : (this.owner === 0 ? '#666' : MAIN_C);
        for (let i = 0; i < dotCount; i++) { 
            let angle = this.orbitAngle + (i * Math.PI * 2 / dotCount); 
            ctx.fillRect(Math.cos(angle) * (r + 8) - 1.5, Math.sin(angle) * (r + 8) - 1.5, 3, 3); 
        }

        ctx.fillStyle = (this.owner === 1) ? '#000' : MAIN_C;
        ctx.textAlign = "center"; ctx.textBaseline = "middle"; 
        ctx.font = "bold 20px monospace";
        ctx.fillText(this.owner === 0 ? "?" : Math.floor(this.unitsCount), 0, 0);

        ctx.restore();
    }
}

class Unit {
    constructor(x, y, target, owner) {
        this.x = x; this.y = y; this.target = target; this.owner = owner;
        const pe = protocolEffects();
        this.baseSpeed = this.owner === 1 ? (3.0 + ((dailyOperationActive?1:upgSpeed) * 0.4)) * pe.speed : 2.8; this.hp = 2 + (this.owner === 1 ? pe.unitHp : 0);
        this.phaseBoost = 1;
        this.suckedBy = null; this.suckDist = 0; this.suckAngle = 0; this.alpha = 1.0;
    }
    update() {
        if (isNaN(this.x) || isNaN(this.y)) { this.hp = 0; return true; }
        if (this.hp <= 0) { const pc=__perfLite?1:3; for (let p = 0; p < pc && particles.length<80; p++) particles.push(new Particle(this.x, this.y)); return true; }
        
        if (this.suckedBy) {
            this.suckAngle += 0.15; this.suckDist -= 1.5; 
            this.alpha = this.suckDist / this.suckedBy.radius; 
            this.x = this.suckedBy.x + Math.cos(this.suckAngle) * this.suckDist;
            this.y = this.suckedBy.y + Math.sin(this.suckAngle) * this.suckDist;
            if (this.suckDist <= 5 || this.alpha <= 0) return true; 
            return false;
        }

        const pe = __framePE || protocolEffects();
        let currentSpeed = this.baseSpeed * this.phaseBoost * (this.owner===1 ? sectorEventValue('speedPlayer',1) : sectorEventValue('speedEnemy',1)); if(this.owner===1 && Date.now()-sectorStartTime<20000) currentSpeed*=pe.openingSpeed;
        for (let ast of asteroids) { const ax=this.x-ast.x, ay=this.y-ast.y; if (ax*ax+ay*ay < ast.r*ast.r) { currentSpeed *= (this.owner===1 ? pe.asteroidSlow : 0.4); break; } }
        
        const dx = this.target.x - this.x; const dy = this.target.y - this.y; const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist === 0) { this.hp = 0; return true; } 

        this.x += (dx / dist) * currentSpeed; this.y += (dy / dist) * currentSpeed; this.angle = Math.atan2(dy, dx); 

        for (let bh of blackHoles) {
            const bdx=this.x-bh.x,bdy=this.y-bh.y, baseR=bh.radius+15;
            const safeR=(this.owner===1 && pe.blackholeSafe<1)?baseR*pe.blackholeSafe:baseR;
            if (bdx*bdx+bdy*bdy < safeR*safeR) {
                this.suckedBy = bh; this.suckDist = Math.sqrt(bdx*bdx+bdy*bdy); this.suckAngle = Math.atan2(bdy, bdx); window.PolishFX?.event('blackhole'); return false;
            }
        }
        
        if (!this.teleported) {
            for (let wh of wormholes) {
                let wx=this.x-wh.x1, wy=this.y-wh.y1;
                if (wx*wx+wy*wy < 400) { this.x = wh.x2; this.y = wh.y2; this.teleported = true; window.PolishFX?.event('wormhole'); break; }
                wx=this.x-wh.x2; wy=this.y-wh.y2;
                if (wx*wx+wy*wy < 400) { this.x = wh.x1; this.y = wh.y1; this.teleported = true; window.PolishFX?.event('wormhole'); break; }
            }
        }
        if (dist < (this.target.radius || 20)) {
            if (this.target instanceof Wormhole) {
                this.x = this.target.twin.x; this.y = this.target.twin.y;
                if (this.owner===1) { const pe=protocolEffects(); this.phaseBoost = pe.phaseSpeed; this.hp += pe.phaseArmor; }
                let nearest = null; let minDist = Infinity;
                nodes.forEach(n => { if (n.owner !== this.owner) { let d = Math.hypot(this.x - n.x, this.y - n.y); if (d < minDist) { minDist = d; nearest = n; } } });
                if (nearest) this.target = nearest; else this.hp = 0;
                return false;
            }

            if (this.target.owner === this.owner) { this.target.unitsCount += this.hp; } 
            else {
                const oldOwner=this.target.owner; const pe=protocolEffects();
                let damage = this.hp;
                if (this.owner===1 && oldOwner===0) damage *= pe.neutralDamage;
                if (this.owner===1 && oldOwner>1) damage *= pe.enemyDamage; if(this.owner===1 && (this.target.isCapital||this.target.isBoss)) damage*=pe.bossDamage;
                if (oldOwner === 1) damage = Math.max(0.5, (this.hp - ((dailyOperationActive?1:upgArmor) - 1) * 0.2) * pe.armor); 
                this.target.unitsCount -= damage;
                // Neutral damage numbers are intentionally hidden: they add visual noise and
                // create many short-lived text objects during large captures on mobile WebViews.
                if(oldOwner!==0){
                    const __ftNow=performance.now();
                    if(!__perfLite || (floatingTexts.length<6 && __ftNow-(this.target.__lastFloatAt||0)>180)){
                        this.target.__lastFloatAt=__ftNow; floatingTexts.push(new FloatingText(this.target.x, this.target.y - 20, `-${Math.ceil(damage)}`));
                    }
                }
                if (this.owner === 1) destroyedEnemies += damage; 
                if (this.target.unitsCount <= 0) { 
                    this.target.owner = this.owner; this.target.unitsCount = Math.abs(this.target.unitsCount); if (this.owner===1 && oldOwner!==1 && currentSectorEvent?.captureBoost) this.target.unitsCount += currentSectorEvent.captureBoost;
                    if (this.owner===1 && oldOwner!==1) { runCaptured++; addDailyProgress('capture',1); window.PolishFX?.event('capture'); }
                    else if (this.owner>1 && oldOwner!==this.owner) { window.PolishFX?.event('enemyCapture'); }
                    if (this.owner===1 && oldOwner!==1 && pe.captureBonus>0) {
                        this.target.unitsCount += pe.captureBonus;
                        if(oldOwner!==0 && (!__perfLite || floatingTexts.length<4)) floatingTexts.push(new FloatingText(this.target.x, this.target.y + 22, `+${Math.floor(pe.captureBonus)}`));
                    }
                    if(this.owner===1 && oldOwner!==1 && pe.capturePulse>0){ nodes.forEach(n=>{ if(n.owner===1 && n!==this.target) n.unitsCount+=pe.capturePulse; }); }
                    screenShake = (window.GameFeedbackSettings?.shake===false ? 0 : 10); const pc=__perfLite?2:10; for (let p = 0; p < pc && particles.length<80; p++) particles.push(new Particle(this.target.x, this.target.y)); if(this.owner===1) window.CosmeticsFX?.capture?.(this.target.x,this.target.y);
                }
            }
            return true;
        }
        return false; 
    }
    draw(MAIN_C) {
        ctx.save(); ctx.globalAlpha = Math.max(0, this.alpha); ctx.translate(this.x, this.y); ctx.rotate(this.angle); ctx.strokeStyle = MAIN_C; ctx.lineWidth = 2; ctx.beginPath();
        if (this.owner === 1) { ctx.moveTo(8, 0); ctx.lineTo(-5, 5); ctx.lineTo(-5, -5); ctx.closePath(); ctx.fillStyle = MAIN_C; ctx.fill(); } 
        else if (this.owner === 2) { ctx.moveTo(8, 0); ctx.lineTo(0, 5); ctx.lineTo(-8, 0); ctx.lineTo(0, -5); ctx.closePath(); ctx.stroke(); }
        else if (this.owner === 3) { let sr = 4; ctx.rect(-sr, -sr, sr*2, sr*2); ctx.stroke(); }
        else if (this.owner === 4) { for (let i = 0; i < 6; i++) { let hx = 5 * Math.cos(Math.PI / 3 * i); let hy = 5 * Math.sin(Math.PI / 3 * i); if (i === 0) ctx.moveTo(hx, hy); else ctx.lineTo(hx, hy); } ctx.closePath(); ctx.stroke(); }
        else { ctx.arc(0, 0, 5, 0, Math.PI*2); ctx.stroke(); }
        ctx.restore();
    }
}

function loadLevel(level) {
    if (!runStarted) { showRunStart(); return; }
    let conf = generateProceduralLevel(level);
    nodes = conf.nodes; blackHoles = conf.blackHoles; asteroids = conf.asteroids; wormholes = conf.wormholes;
    currentSectorEvent = conf.sectorEvent || getSectorEvent(level);
    if(currentSectorEvent?.kind==='boss') setTimeout(()=>window.PolishFX?.event('boss'),120);
    const pe = protocolEffects();
    nodes.forEach(n => { if (n.owner === 1 && n.isCapital) n.unitsCount += ((dailyOperationActive?1:upgStart) - 1) * 5 + pe.start + (reviveBoostPending ? 20 : 0); });
    if(reviveBoostPending) reviveBoostPending=false;
    sectorStartTime = Date.now();

    units = []; particles = []; floatingTexts = []; lasers = []; selectedNodes = [];
    isDragging = false; tapSource = null; gestureNode = null; selectedNodes = []; gameState = 'playing'; destroyedEnemies = 0; screenShake = 0; levelWon = false;
    
    let shop = document.getElementById('shopUI');
    if (shop) shop.classList.remove('open'); 
    
    initStars(); applyThemeColor(); window.currentLevelConfig = conf; updateSectorAlert(); saveProgress();
    telemetryTrack('sector_start',{sector:level,event:currentSectorEvent?.kind||'normal',enemy_factions:new Set(nodes.filter(n=>n.owner>1).map(n=>n.owner)).size,nodes:nodes.length}); 
}


let menuPanelOpen = '';
function clearMenuPanels(){
    const meta=document.getElementById('metaPanel'), retention=document.getElementById('retentionPanel'), cosmetics=document.getElementById('cosmeticsPanel');
    if(meta){meta.innerHTML='';meta.classList.remove('open');}
    if(retention){retention.innerHTML='';retention.classList.remove('open');}
    if(cosmetics){cosmetics.innerHTML='';cosmetics.classList.remove('open');}
}
function renderMenuQuickNav(mode='none'){
    const nav=document.getElementById('menuQuickNav'); if(!nav) return;
    nav.className=`menu-quick-nav mode-${mode}`;
    if(!['start','end'].includes(mode)){ nav.innerHTML=''; menuPanelOpen=''; return; }
    const next=nextMilestone();
    const metaOwnedCount=META_NODES.filter(n=>metaOwned(n.id)).length;
    const cosmeticSummary=window.CosmeticsSystem?.summary?.() || {owned:5,total:21};
    nav.innerHTML=`<button data-menu-panel="meta"><b>META CORE</b><span>✦ ${darkMatter} // ${metaOwnedCount}/${META_NODES.length}</span></button><button data-menu-panel="retention"><b>SIGNAL LOG</b><span>${next?`NEXT S${String(next.sector).padStart(3,'0')}`:'ALL MILESTONES'}</span></button><button data-menu-panel="cosmetics"><b>SIGNAL STYLES</b><span>${cosmeticSummary.owned}/${cosmeticSummary.total} OWNED</span></button>`;
    nav.querySelectorAll('[data-menu-panel]').forEach(btn=>btn.addEventListener('click',()=>{
        const target=btn.dataset.menuPanel, same=menuPanelOpen===target;
        clearMenuPanels(); menuPanelOpen=same?'':target;
        nav.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.menuPanel===menuPanelOpen));
        if(menuPanelOpen==='meta') renderMetaPanel(true);
        if(menuPanelOpen==='retention') renderRetentionPanel(true);
        if(menuPanelOpen==='cosmetics') window.CosmeticsSystem?.render?.(true);
        window.PolishFX?.event('select');
    }));
}
function setShopMode(mode){
    const shop=document.getElementById('shopUI'); if(shop) shop.dataset.mode=mode;
    document.body.dataset.shopMode=mode;
    if(!['start','end'].includes(mode)){ menuPanelOpen=''; renderMenuQuickNav('none'); }
}
function compactRunStats(items){
    return `<div class="stat-strip">${items.map(([label,value,accent])=>`<div class="stat-cell ${accent?'accent':''}"><small>${label}</small><b>${value}</b></div>`).join('')}</div>`;
}

function makeRunSeed() {
    const now = Date.now() >>> 0;
    const perf = Math.floor((typeof performance !== 'undefined' ? performance.now() : Math.random()*99999) * 1000) >>> 0;
    return ((now ^ perf ^ Math.floor(Math.random()*0xffffffff)) >>> 0) || 1;
}
function prepareFreshRun() {
    if (runSeed) runNumber += 1;
    currentLevel = 1; runSectorsCleared = 0; runSeed = makeRunSeed(); runStarted = false; runMatter = 0; runCaptured = 0; runPayoutBanked = false; activeProtocols = {}; protocolChoicePending = false; protocolChoiceLevel = 0; awaitingNextSector = false; continueUsed=false; runAwaitingDecision=false; reviveBoostPending=false; lastRunPayout=0; doublePayoutAvailable=false; doublePayoutClaimed=false; protocolRerollNonce=0; protocolRerollUsedLevel=0; protocolPaidRerollUsedLevel=0; protocolBoostedRerollLevel=0;
    pendingReward = 0; destroyedEnemies = 0; levelWon = false; saveProgress();
}
function showRunStart() {
    if (!runStarted && !runSeed) { runSeed = makeRunSeed(); saveProgress(); }
    gameState = 'shop'; levelWon = false; setShopMode('start');
    const shop = document.getElementById('shopUI'); if (shop) shop.classList.add('open');
    const title = document.getElementById('shopTitle'); if (title) title.textContent = '>_1-BIT SECTOR';
    const sub = document.getElementById('shopSubtitle'); if (sub) sub.textContent = 'NEW RUN // 40 SECTORS // 5 ACTS';
    const stats = document.getElementById('runStats');
    if (stats) stats.innerHTML = compactRunStats([['BEST',String(bestSector).padStart(3,'0'),false],['DARK MATTER',`${darkMatter} ✦`,true],['RUN',`#${runNumber}`,false]]) + `<div class="menu-brief">BUILD формується під час RUN. META зберігається між забігами.</div>`;
    protocolChoicePending = false; protocolChoiceLevel = 0; awaitingNextSector = false;
    renderProtocolChoice(); renderMonetizationPanel(); clearMenuPanels(); renderMenuQuickNav('start');
    const btn = document.getElementById('btnAction'); if (btn) { btn.style.display='block'; btn.disabled=false; btn.textContent = runStarted ? 'ПРОДОВЖИТИ RUN >>' : 'ПОЧАТИ RUN >>'; }
    document.querySelectorAll('.legacy-shop').forEach(el => el.style.display = 'none');
}
function startNewRun() {
    dailyOperationActive=false; dailyOperationKey=''; dailyOperationStartedAt=0;
    // If this is the prepared first run, keep its previewed seed. Otherwise make a fresh one.
    if (runEnded || runStarted || (gameState === 'shop' && levelWon)) { prepareFreshRun(); runEnded = false; }
    if (!runSeed) runSeed = makeRunSeed();
    currentLevel = 1; runSectorsCleared = 0; runStarted = true; runEnded = false; postRunShopPending = false; runThreatLevel = Math.max(0,Math.min(maxThreatUnlocked,selectedThreatLevel)); lastThreatUnlock = 0; runMatter = 0; runCaptured = 0; runPayoutBanked = false; activeProtocols = {}; protocolChoicePending = false; protocolChoiceLevel = 0; awaitingNextSector = false; continueUsed=false; runAwaitingDecision=false; reviveBoostPending=false; lastRunPayout=0; doublePayoutAvailable=false; doublePayoutClaimed=false; protocolRerollNonce=0; protocolRerollUsedLevel=0; protocolPaidRerollUsedLevel=0; protocolBoostedRerollLevel=0;
    pendingReward = 0; destroyedEnemies = 0; levelWon = false; saveProgress();
    telemetryTrack('run_start',{selected_threat:runThreatLevel,seed_bucket:(runSeed>>>0)%1000});
    try{ if(pdParent!==window) pdParent.postMessage({playdeck:{method:'sendAnalyticNewSession'}},'*'); }catch(e){}
    loadLevel(1);
}
function continueRun() {
    if (!runStarted || !runSeed) {
        if (!runSeed) runSeed = makeRunSeed();
        runSectorsCleared = 0; runStarted = true; currentLevel = 1; saveProgress();
    }
    loadLevel(currentLevel);
}

function showPendingProtocolChoice(){
    gameState='shop'; levelWon=true; setShopMode('protocol');
    const shop=document.getElementById('shopUI'); if(shop) shop.classList.add('open');
    const title=document.getElementById('shopTitle'); if(title) title.textContent='>_SECTOR CLEAR';
    const sub=document.getElementById('shopSubtitle'); if(sub) sub.textContent=`S${String(currentLevel).padStart(3,'0')} // SELECT 1 PROTOCOL`;
    const stats=document.getElementById('runStats'); if(stats) stats.innerHTML=compactRunStats([['REWARD',`+${pendingReward} ✦`,true],['RUN BANK',`${runMatter} ✦`,false],['PROGRESS',`${runSectorsCleared}/${RUN_LENGTH}`,false]]);
    clearMenuPanels(); renderProtocolChoice(); renderMonetizationPanel();
    const btn=document.getElementById('btnAction'); if(btn){btn.style.display='none';btn.disabled=true;}
}
function showBetweenSectorReady(){
    gameState='shop'; levelWon=true; setShopMode('ready');
    const shop=document.getElementById('shopUI'); if(shop) shop.classList.add('open');
    const title=document.getElementById('shopTitle'); if(title) title.textContent='>_PROTOCOL ONLINE';
    const sub=document.getElementById('shopSubtitle'); if(sub) sub.textContent=`NEXT // SECTOR ${String(currentLevel+1).padStart(3,'0')}`;
    const stats=document.getElementById('runStats'); if(stats) stats.innerHTML=compactRunStats([['BUILD',`${totalProtocolStacks()} STACKS`,true],['RUN BANK',`${runMatter} ✦`,false],['NEXT',String(currentLevel+1).padStart(3,'0'),false]]);
    clearMenuPanels(); renderProtocolChoice(); renderMonetizationPanel();
    const btn=document.getElementById('btnAction'); if(btn){btn.style.display='block';btn.disabled=false;btn.textContent='НАСТУПНИЙ СЕКТОР >>';}
}

function updateShopUI() {
    if(!document.getElementById('btnSpeed')) return;
    document.getElementById('btnSpeed').textContent = `Lvl ${upgSpeed} (${upgSpeed * 100})`; document.getElementById('btnCapacity').textContent = `Lvl ${upgCapacity} (${upgCapacity * 150})`;
    document.getElementById('btnProd').textContent = `Lvl ${upgProd} (${upgProd * 120})`; document.getElementById('btnArmor').textContent = `Lvl ${upgArmor} (${upgArmor * 150})`;
    document.getElementById('btnStart').textContent = `Lvl ${upgStart} (${upgStart * 100})`; document.getElementById('btnYield').textContent = `Lvl ${upgYield} (${upgYield * 200})`;
    
    let shopDM = document.getElementById('shopDMCount');
    if (shopDM) shopDM.textContent = darkMatter;
    
    applyThemeColor();
}

function buyUpgrade(varName, costMult) {
    const getLevel = () => ({upgSpeed,upgCapacity,upgProd,upgArmor,upgStart,upgYield}[varName] || 1);
    const currentLvl = getLevel(); const cost = currentLvl * costMult;
    if (darkMatter < cost) return;
    darkMatter -= cost;
    if (varName === 'upgSpeed') upgSpeed++;
    else if (varName === 'upgCapacity') upgCapacity++;
    else if (varName === 'upgProd') upgProd++;
    else if (varName === 'upgArmor') upgArmor++;
    else if (varName === 'upgStart') upgStart++;
    else if (varName === 'upgYield') upgYield++;
    saveProgress(); updateShopUI();
}
['Speed', 'Capacity', 'Prod', 'Armor', 'Start', 'Yield'].forEach((u, i) => {
    if(document.getElementById('btn'+u)) document.getElementById('btn'+u).addEventListener('click', (e) => { e.stopPropagation(); buyUpgrade('upg'+u, [100,150,120,150,100,200][i]); });
});

if(document.getElementById('btnAction')) {
    document.getElementById('btnAction').addEventListener('click', () => {
        if (runAwaitingDecision) { finalizeFailedRun(); return; }
        if (protocolChoicePending) return;
        if (!runStarted) { startNewRun(); return; }
        if (gameState === 'shop' && levelWon) {
            if (currentLevel >= RUN_LENGTH) { startNewRun(); return; }
            awaitingNextSector=false; currentLevel++; runSectorsCleared = currentLevel - 1; saveProgress(); loadLevel(currentLevel); return;
        }
        continueRun();
    });
}

function openShop(isWin) {
    if (gameState === 'shop') return;
    if(dailyOperationActive && !isWin){ finishDailyOperation(false); return; }
    try {
        // Wins use the full shop/menu screen. A loss must keep the defeated sector visible
        // behind a pause-style decision modal, so do NOT switch into the full shop state here.
        gameState = isWin ? 'shop' : 'defeat';
        levelWon = isWin;
        setShopMode(isWin?(currentLevel>=RUN_LENGTH?'end':'protocol'):'death');
        let reward;
        if(isWin){
            const baseReward = Math.round(4 + Math.min(currentLevel,16)*0.55 + Math.max(0,currentLevel-16)*0.24);
            const combatBonus = Math.min(6 + Math.floor(currentLevel*.30), Math.floor(destroyedEnemies * .22));
            reward = baseReward + combatBonus;
        } else {
            reward = Math.min(8 + Math.floor(currentLevel*.45), Math.floor(destroyedEnemies * .12));
        }
        if (isWin) {
            const threatReward = currentSectorEvent?.kind==='boss' ? 1 : threatConfig().reward;
            reward = Math.floor(reward * protocolEffects().reward * sectorEventValue('reward',1) * threatReward);
        }
        pendingReward = Math.max(0, reward);
        runMatter += pendingReward;
        if (isWin) {
            runSectorsCleared = Math.max(runSectorsCleared, currentLevel);
            addDailyProgress('clear',1);
            if(currentSectorEvent?.kind==='boss') totalBosses += 1;
            else if(currentSectorEvent?.kind==='event') totalEventsCleared += 1;
        }
        bestSector = Math.max(bestSector, currentLevel);
        telemetryTrack(isWin?'sector_clear':'sector_fail',{sector:currentLevel,reward:pendingReward,run_bank:runMatter,captured:runCaptured,event:currentSectorEvent?.kind||'normal',build_stacks:totalProtocolStacks()});
        syncRetentionRewards();
        saveProgress();
        if(!dailyOperationActive){ /* normal progression is reported through sendGameProgress */ }
        try { pdParent.postMessage({ playdeck: { method: 'sendGameProgress', value: { progress: { level: currentLevel, isLastLevel: currentLevel >= RUN_LENGTH } } } }, '*'); } catch(e){}
        const shop = document.getElementById('shopUI');
        if (shop) {
            if (isWin) shop.classList.add('open');
            else shop.classList.remove('open');
        }
        const title = document.getElementById('shopTitle');
        const sub = document.getElementById('shopSubtitle');
        const stats = document.getElementById('runStats');
        const btn = document.getElementById('btnAction');
        document.querySelectorAll('.legacy-shop').forEach(el => el.style.display = 'none');
        if (isWin && currentLevel >= RUN_LENGTH) {
            if(dailyOperationActive){ finishDailyOperation(true); return; }
            runEnded = true; postRunShopPending = true;
            const threatUnlocked=unlockNextThreatAfterClear();
            const payout=bankRunPayout(); lastRunPayout=payout; doublePayoutAvailable=payout>0; doublePayoutClaimed=false; telemetryTrack('run_end',{result:'clear',reached:RUN_LENGTH,cleared:RUN_LENGTH,payout,captured:runCaptured,build_stacks:totalProtocolStacks(),threat_unlock:threatUnlocked||0}); saveProgress(); notifyPlayDeckGameEnd('run_clear');
            if (title) title.textContent = dailyOperationActive?'>_DAILY COMPLETE':'>_RUN ЗАВЕРШЕНО';
            if (sub) sub.textContent = dailyOperationActive?`${dailyOperationKey} • ${RUN_LENGTH}/${RUN_LENGTH}`:`RUN #${runNumber} • ${RUN_LENGTH}/${RUN_LENGTH} СЕКТОРІВ`;
            const available=nextAffordableUnlock();
            if (stats) stats.innerHTML = `<div class="run-complete-banner"><small>FULL CLEAR</small><b>40 / 40</b><span>ALL 5 ACTS CLEARED</span></div>` + compactRunStats([['CAPTURED',String(runCaptured),false],['WARDENS','5',false],['PAYOUT',`+${payout} ✦`,true]]) + (available?`<div class="unlock-ready">UNLOCK READY // ${available.name}</div>`:'');
            protocolChoicePending = false; protocolChoiceLevel = 0; awaitingNextSector=false; renderProtocolChoice(); clearMenuPanels(); renderMenuQuickNav('end'); renderMonetizationPanel();
            if (btn) { btn.style.display='block'; btn.disabled=false; btn.textContent = 'НОВИЙ RUN >>'; }
        } else if (isWin) {
            if (title) title.textContent = currentSectorEvent?.kind==='boss' ? '>_WARDEN ЗНИЩЕНО' : '>_СЕКТОР ОЧИЩЕНО';
            if (sub) sub.textContent = `RUN #${runNumber} • СЕКТОР ${String(currentLevel).padStart(3,'0')}`;
            if (stats) stats.innerHTML = compactRunStats([['REWARD',`+${pendingReward} ✦`,true],['RUN BANK',`${runMatter} ✦`,false],['PROGRESS',`${runSectorsCleared}/${RUN_LENGTH}`,false]]) + (currentSectorEvent?.kind==='boss'?`<div class="boss-clear">WARDEN DOWN // TIER ${currentSectorEvent.bossTier}</div>`:'');
            protocolChoicePending = true; protocolChoiceLevel = currentLevel; awaitingNextSector=false; protocolRerollNonce=0; protocolRerollUsedLevel=0; protocolPaidRerollUsedLevel=0; protocolBoostedRerollLevel=0; adStatus=''; saveProgress(); clearMenuPanels(); renderProtocolChoice(); renderMonetizationPanel();
            if (btn) { btn.style.display='none'; btn.disabled=true; }
        } else {
            const reached=currentLevel;
            runAwaitingDecision=true; runEnded=false; runStarted=true; adStatus='';
            if (title) title.textContent = '>_SIGNAL LOST';
            if (sub) sub.textContent = `RUN #${runNumber} • СЕКТОР ${String(reached).padStart(3,'0')}`;
            if (stats) stats.innerHTML = compactRunStats([['REACHED',String(reached).padStart(3,'0'),false],['BANK NOW',`${projectedRunPayout()} ✦`,true],['BUILD',`${totalProtocolStacks()} STACKS`,false]]) + `<div class="death-choice"><b>ОБЕРИ 1 РІШЕННЯ</b><span>Другий шанс зберігає RUN. Завершення одразу переносить банк у Dark Matter.</span></div>`;
            protocolChoicePending=false; protocolChoiceLevel=0; awaitingNextSector=false; clearMenuPanels(); renderProtocolChoice(); renderMonetizationPanel();
            if (btn) { btn.style.display='block'; btn.disabled=false; btn.textContent = `ЗАВЕРШИТИ RUN // +${projectedRunPayout()} ✦`; }
            saveProgress();
        }
    } catch(err) { console.error('Run UI error:', err); }
}


function showSavedRunEnd(){
    gameState='shop'; levelWon = runSectorsCleared >= RUN_LENGTH; setShopMode('end');
    const shop=document.getElementById('shopUI'); if(shop) shop.classList.add('open');
    const completed=runSectorsCleared>=RUN_LENGTH;
    const title=document.getElementById('shopTitle'); if(title) title.textContent=completed?'>_RUN ЗАВЕРШЕНО':'>_RUN ПЕРЕРВАНО';
    const sub=document.getElementById('shopSubtitle'); if(sub) sub.textContent=`RUN #${runNumber} • СЕКТОР ${String(currentLevel).padStart(3,'0')}`;
    const stats=document.getElementById('runStats'); const available=nextAffordableUnlock();
    if(stats) stats.innerHTML=compactRunStats([['REACHED',String(currentLevel).padStart(3,'0'),false],['CAPTURED',String(runCaptured),false],['PAYOUT',`+${lastRunPayout} ✦`,true]]) + (available?`<div class="unlock-ready">UNLOCK READY // ${available.name}</div>`:'');
    renderProtocolChoice(); clearMenuPanels(); renderMenuQuickNav('end'); renderMonetizationPanel();
    const btn=document.getElementById('btnAction'); if(btn){btn.style.display='block';btn.disabled=false;btn.textContent='НОВИЙ RUN >>';}
}

let winTimer = null;
function checkWinLoss() {
    if (gameState !== 'playing') return;
    let pObj = nodes.some(n => n.owner === 1);
    let pUnits = units.some(u => u.owner === 1);
    let eObj = nodes.some(n => n.owner > 1);
    let eUnits = units.some(u => u.owner > 1);

    if (!eObj && !eUnits && units.length === 0) { 
        if (!winTimer) winTimer = setTimeout(() => { openShop(true); winTimer = null; }, 1500); 
    } 
    else if (!pObj && !pUnits && units.length === 0) { 
        if (!winTimer) winTimer = setTimeout(() => { openShop(false); winTimer = null; }, 1500); 
    } else {
        if (winTimer) { clearTimeout(winTimer); winTimer = null; } 
    }
}

function spawnFleetPackets(startNode,target,actualSendCount,delayStep=72){
    if(actualSendCount<=0) return;
    const pe=protocolEffects();
    const originalObjects=Math.floor(actualSendCount/2)+(actualSendCount%2?1:0);
    // Preserve the exact total combat strength of the old representation.
    const totalHp=startNode.owner===1
        ? Math.floor(actualSendCount/2)*(2+pe.unitHp)+(actualSendCount%2?1:0)
        : actualSendCount;
    const lowPower=__perfLite||((navigator.deviceMemory||4)<=2)||((navigator.hardwareConcurrency||8)<=4);
    // Fewer visual packets on Telegram/Firefox/mobile; total fleet HP stays exactly the same.
    const maxPackets=__perfLite?6:(lowPower?8:13);
    const packetCount=Math.max(1,Math.min(originalObjects,maxPackets));
    const hpPerPacket=totalHp/packetCount;
    const spread=Math.min(720,Math.max(0,(packetCount-1)*delayStep));
    for(let i=0;i<packetCount;i++){
        const delay=packetCount<=1?0:Math.round((i/(packetCount-1))*spread);
        setTimeout(()=>{ if(gameState==='playing'){ const u=new Unit(startNode.x,startNode.y,target,startNode.owner); u.hp=hpPerPacket; units.push(u); } },delay);
    }
}

function sendFleet(startNodes, target) {
    if (!target) return;
    startNodes.forEach(startNode => {
        if (startNode === target) return;
        const actualSendCount = Math.floor(startNode.unitsCount * protocolEffects().sendRatio);
        if (actualSendCount <= 0) return;
        startNode.unitsCount -= actualSendCount;
        startNode.pulse = 8;
        spawnFleetPackets(startNode,target,actualSendCount,72);
    });
}
function getPointerPos(e) { return { x: e.clientX, y: e.clientY }; }
function pointerDown(e) {
    if (gameState !== 'playing') return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const pos = getPointerPos(e);
    const clickedNode = nodes.find(n => Math.hypot(n.x - pos.x, n.y - pos.y) < n.radius + 10);
    // Після першого TAP дозволяємо почати другий TAP на будь-якій цілі,
    // включно з нейтральною планетою або ворожою базою.
    const canStart = clickedNode && (clickedNode.owner === 1 || tapSource);
    if (!canStart) return;
    e.preventDefault(); canvas.setPointerCapture?.(e.pointerId);
    gestureStartX = pos.x; gestureStartY = pos.y; gestureNode = clickedNode; gestureMoved = false;
    currentX = pos.x; currentY = pos.y;
}
function pointerMove(e) {
    if (!gestureNode || gameState !== 'playing') return;
    const pos = getPointerPos(e); currentX = pos.x; currentY = pos.y;
    if (!gestureMoved && Math.hypot(pos.x - gestureStartX, pos.y - gestureStartY) > 9) {
        gestureMoved = true; isDragging = true; selectedNodes = [gestureNode];
    }
    if (isDragging) {
        const hoveredNode = nodes.find(n => Math.hypot(n.x - pos.x, n.y - pos.y) < n.radius + 10);
        if (hoveredNode && hoveredNode.owner === 1 && !selectedNodes.includes(hoveredNode)) selectedNodes.push(hoveredNode);
    }
}
function pointerUp(e) {
    if (gameState !== 'playing' || !gestureNode) { gestureNode = null; isDragging = false; selectedNodes = []; return; }
    const pos = getPointerPos(e); currentX = pos.x; currentY = pos.y;
    const target = nodes.find(n => Math.hypot(n.x - currentX, n.y - currentY) < n.radius + 10) || wormholes.find(w => Math.hypot(w.x - currentX, w.y - currentY) < 26);

    if (!gestureMoved) {
        // TAP → TAP: перший тап вибирає свою базу, другий — ціль.
        if (!tapSource) {
            tapSource = gestureNode; selectedNodes = [tapSource];
        } else if (target && target !== tapSource) {
            sendFleet([tapSource], target); tapSource = null; selectedNodes = [];
        } else if (target === tapSource) {
            tapSource = null; selectedNodes = [];
        }
    } else if (isDragging && selectedNodes.length > 0) {
        if (target) sendFleet(selectedNodes, target);
        tapSource = null; selectedNodes = [];
    }
    isDragging = false; gestureNode = null; gestureMoved = false;
}

canvas.addEventListener('pointerdown', pointerDown, {passive:false}); canvas.addEventListener('pointermove', pointerMove, {passive:false}); canvas.addEventListener('pointerup', pointerUp, {passive:false}); canvas.addEventListener('pointercancel', pointerUp, {passive:false});

setInterval(() => {
    if (gameState === 'playing') {
        nodes.forEach(node => {
            if (node.owner !== 0) {
                const pe=protocolEffects();
                let limit = 100 + (node.owner === 1 ? ((dailyOperationActive?1:upgCapacity) - 1) * 20 + pe.capacity : 0); if(node.owner===1) limit=Math.floor(limit*pe.capacityFactor); if (node.type === 2) limit = Math.floor(limit * 1.5);
                if (node.isBoss) limit = Math.floor(limit * (1.30 + .12*(node.bossTier||1))); if (node.unitsCount < limit) { let gain = (node.type === 1) ? 2 : 1; if (node.owner === 1) { gain = (gain + ((dailyOperationActive?1:upgProd) - 1) * 0.2) * pe.prod * sectorEventValue('prodPlayer',1); if (Date.now()-sectorStartTime < 25000) gain *= pe.surge; if(nodes.filter(n=>n.owner===1).length<=2) gain*=pe.comebackProd; } else { const act=Math.min(5,Math.floor((currentLevel-1)/8)+1); const diff=runDifficultyCurve(currentLevel); gain *= (1+(currentLevel-1)*0.021+(act-1)*0.07) * diff.enemyProd * threatConfig().enemyProd * sectorEventValue('prodEnemy',1); if(node.isBoss) gain *= 1.12 + .08*(node.bossTier||1); } node.unitsCount += gain; if (node.unitsCount > limit) node.unitsCount = limit; }
            }
        });
    }
}, 1000);

function pointLineDistance(px, py, ax, ay, bx, by) {
    const dx=bx-ax, dy=by-ay; const len2=dx*dx+dy*dy || 1;
    const t=Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/len2));
    const qx=ax+t*dx, qy=ay+t*dy; return Math.hypot(px-qx,py-qy);
}
function routeDanger(a,b) {
    let danger=0;
    blackHoles.forEach(h=>{ const d=pointLineDistance(h.x,h.y,a.x,a.y,b.x,b.y); if(d<h.radius+24) danger += 3; else if(d<h.radius+70) danger += 0.7; });
    asteroids.forEach(o=>{ const d=pointLineDistance(o.x,o.y,a.x,a.y,b.x,b.y); if(d<o.r+18) danger += 0.8; });
    return danger;
}
function nearestEnemyFrom(x,y,owner) {
    let best=null, bd=Infinity; nodes.forEach(n=>{ if(n.owner!==0 && n.owner!==owner){ let d=Math.hypot(x-n.x,y-n.y); if(d<bd){bd=d;best=n;} } });
    return best;
}
function factionStrength(owner){
    let score=0;
    nodes.forEach(n=>{if(n.owner===owner) score+=n.unitsCount+(n.isCapital?42:0)+(n.type===1?10:0);});
    units.forEach(u=>{if(u.owner===owner) score+=Math.max(1,u.hp||1);});
    return score;
}
function botProfile(personality){
    if(personality==='aggressive') return {reserve:.32, threshold:20, send:.61, neutral:34, enemy:96, capital:10, risk:1.12};
    if(personality==='expansionist') return {reserve:.43, threshold:25, send:.51, neutral:82, enemy:48, capital:-18, risk:.82};
    if(personality==='tactician') return {reserve:.49, threshold:28, send:.53, neutral:50, enemy:70, capital:2, risk:.62};
    return {reserve:.47, threshold:28, send:.52, neutral:50, enemy:60, capital:-8, risk:.78};
}
// V5.9.24 AI V2: CORE I must already feel tactically different from BASELINE.
function aiCoreSkill(){ return Math.max(0,Math.min(3,Number(runThreatLevel)||0)); }
function nearestHostileDistance(node,owner){
    let best=Infinity;
    nodes.forEach(n=>{if(n.owner>0&&n.owner!==owner){const d=Math.hypot(node.x-n.x,node.y-n.y);if(d<best)best=d;}});
    return best;
}
function botActionSendCount(node,action,profile,skill,personality){
    const reserveRatio=Math.min(.62,profile.reserve + (node.isCapital ? .04 : 0));
    const reserveUnits=Math.max(8,Math.ceil(node.unitsCount*reserveRatio));
    const spare=Math.max(0,Math.floor(node.unitsCount-reserveUnits));
    if(spare<8)return 0;
    if(action.kind==='reinforce'){
        return Math.max(0,Math.min(spare,Math.ceil(action.need||8)));
    }
    if(action.kind==='portal'){
        const desired=Math.ceil(node.unitsCount*Math.max(.38,profile.send-(skill*.025)));
        return Math.max(8,Math.min(spare,desired));
    }
    const target=action.target;
    if(!target)return 0;
    const dist=Math.hypot(node.x-target.x,node.y-target.y);
    const travelBuffer=Math.min(12,Math.floor(dist/150))*(target.owner>0?1.2:.55);
    let margin=target.owner===0 ? 1.04 : (1.22-skill*.025);
    if(target.isCapital||target.isBoss) margin+=.09;
    let needed=Math.ceil(target.unitsCount*margin + 5 + travelBuffer);
    if(action.kind==='stage') needed=Math.min(needed,Math.ceil(target.unitsCount*1.08+6));
    if(needed<=spare)return Math.max(8,needed);
    // Do not constantly empty strongholds on attacks that are clearly underpowered.
    if(spare < target.unitsCount*(personality==='aggressive'?0.82:0.94)) return 0;
    return Math.max(8,Math.min(spare,Math.ceil(spare*.86)));
}
function botChooseAction(node, personality) {
    const profile=botProfile(personality), skill=aiCoreSkill();
    const reserveRatio=Math.min(.62,profile.reserve + (node.isCapital ? .04 : 0));
    const available=Math.floor(node.unitsCount*(1-reserveRatio));
    if(available<8)return null;
    const rivalOwners=[...new Set(nodes.filter(n=>n.owner>0&&n.owner!==node.owner).map(n=>n.owner))];
    const strengths={}; rivalOwners.forEach(o=>strengths[o]=factionStrength(o));
    const strongest=rivalOwners.slice().sort((a,b)=>(strengths[b]||0)-(strengths[a]||0))[0];
    const sourceEnemyDist=nearestHostileDistance(node,node.owner);
    const hazardSense=profile.risk*(1+skill*.28);
    let best=null,bestScore=-Infinity,bestReinforce=null,bestReinforceScore=-Infinity;

    // Reinforce a weak/front-line friendly node instead of mindlessly launching another attack.
    nodes.forEach(n=>{
        if(n===node||n.owner!==node.owner)return;
        const dist=Math.hypot(node.x-n.x,node.y-n.y);
        const enemyDist=nearestHostileDistance(n,node.owner);
        if(!Number.isFinite(enemyDist))return;
        const desired=profile.threshold+10+skill*6+(n.isCapital?10:0);
        const deficit=desired-n.unitsCount;
        const frontRange=skill>=1 ? (335+skill*35) : 270;
        if(deficit<=4||enemyDist>frontRange||node.unitsCount<n.unitsCount+12)return;
        let score=38+deficit*1.55+Math.max(0,frontRange-enemyDist)/8+(n.isCapital?15:0)-dist/28;
        if(sourceEnemyDist<enemyDist-35)score-=14;
        score-=routeDanger(node,n)*20*hazardSense;
        if(skill===0)score-=10; else score+=14+skill*6;
        const candidate={target:n,score,kind:'reinforce',need:Math.max(8,deficit+6),urgent:deficit>=14||enemyDist<150};
        if(score>bestReinforceScore){bestReinforceScore=score;bestReinforce=candidate;}
        if(score>bestScore){bestScore=score;best=candidate;}
    });

    nodes.forEach(n=>{
        if(n.owner===node.owner)return;
        const dist=Math.hypot(node.x-n.x,node.y-n.y);
        const danger=routeDanger(node,n);
        let score=n.owner===0?profile.neutral:profile.enemy;
        score+=Math.max(0,58-n.unitsCount)*.82;
        if(n.type===1)score+=26;
        if(n.type===2)score-=14;
        if(n.isCapital)score+=profile.capital;
        if(n.owner>0&&n.owner===strongest)score+=personality==='tactician'?26:14;
        if(n.owner>0&&available>n.unitsCount*1.45)score+=22;
        score-=dist/22;
        score-=danger*22*hazardSense;
        // CORE I+ already avoids obviously bad black-hole lines; higher cores are stricter.
        if(skill>=1&&danger>=2.6)score-=62+skill*18;
        if(skill>=2&&danger>=3.2)score-=48+skill*14;
        if(skill>=3&&danger>=3.8)score-=65;
        if(available<=n.unitsCount*1.05)score-=personality==='aggressive'?24:38;

        let kind='attack';
        if(n.owner===0){
            // Prefer neutrals that move the faction's frontier toward a rival: natural staging.
            const targetEnemyDist=nearestHostileDistance(n,node.owner);
            if(Number.isFinite(sourceEnemyDist)&&Number.isFinite(targetEnemyDist)){
                const progress=Math.max(-14,Math.min(26,(sourceEnemyDist-targetEnemyDist)/14));
                const stageWeight=skill>=1 ? (1.00+skill*.24) : .38;
                score+=progress*stageWeight;
                if(progress>3&&skill>=1)kind='stage';
            }
        }
        if(score>bestScore){bestScore=score;best={target:n,score,kind};}
    });

    if(skill>=1&&bestReinforce&&(bestReinforce.urgent||bestReinforceScore>=bestScore-5)) return bestReinforce;

    let portalBest=null,portalScore=-Infinity;
    wormholes.forEach(w=>{
        const exit=w.twin;if(!exit)return;
        const enemy=nearestEnemyFrom(exit.x,exit.y,node.owner);if(!enemy)return;
        const direct=Math.hypot(node.x-enemy.x,node.y-enemy.y);
        const via=Math.hypot(node.x-w.x,node.y-w.y)+Math.hypot(exit.x-enemy.x,exit.y-enemy.y);
        const saving=direct-via;
        const minSaving=skill>=1 ? (82-skill*8) : 108;
        if(saving<minSaving)return;
        const entryDanger=routeDanger(node,w),exitDanger=routeDanger(exit,enemy);
        if(skill>=2&&exitDanger>=2.8)return;
        let ps=saving/8-(entryDanger+exitDanger*.75)*18*hazardSense+skill*9;
        if(enemy.owner===strongest)ps+=12;
        if(enemy.isCapital&&enemy.unitsCount<available*.85)ps+=10;
        if(ps>portalScore){portalScore=ps;portalBest={target:w,score:ps,enemy,kind:'portal'};}
    });
    if(portalBest&&portalScore>(best?best.score:-Infinity)+(skill>=1?1:8))return portalBest;
    return best;
}

setInterval(() => {
    if(gameState!=='playing')return;
    const personalities=window.currentLevelConfig?.botPersonalities||{2:(window.currentLevelConfig?.botPersonality||'balanced')};
    const difficulty=Math.min(1.45,currentLevel/32),skill=aiCoreSkill(),now=Date.now();
    const botNodes=nodes.filter(n=>n.owner>1).sort((a,b)=>b.unitsCount-a.unitsCount);
    const ownerCounts={};botNodes.forEach(n=>ownerCounts[n.owner]=(ownerCounts[n.owner]||0)+1);
    const actionsByOwner={};
    botNodes.forEach(node=>{
        const personality=personalities[node.owner]||'balanced';
        const profile=botProfile(personality);
        if(node.unitsCount<profile.threshold)return;
        if((node.aiNextAt||0)>now)return;
        const maxFactionActions=(skill>=3&&ownerCounts[node.owner]>=3)?2:(skill>=2&&ownerCounts[node.owner]>=5?2:1);
        if((actionsByOwner[node.owner]||0)>=maxFactionActions)return;
        const action=botChooseAction(node,personality);
        if(!action||action.score<(skill>=1?13:18))return;
        const factionPenalty=Math.max(0,(window.currentLevelConfig?.botCount||1)-1)*.055;
        const chance=Math.max(.20,Math.min(.94,.52+difficulty*.20+(personality==='aggressive' ? .08 : 0)+(personality==='tactician' ? .025 : 0)+sectorEventValue('aggression',0)+protocolEffects().botAggro+threatConfig().botAggro+skill*.045-factionPenalty));
        if(gameplayRandom()>chance)return;
        const actualSendCount=botActionSendCount(node,action,profile,skill,personality);
        if(actualSendCount<8)return;
        node.unitsCount-=actualSendCount;node.pulse=10;
        node.aiNextAt=now+Math.max(1300,2050-skill*210)+Math.floor(gameplayRandom()*260);
        actionsByOwner[node.owner]=(actionsByOwner[node.owner]||0)+1;
        window.PolishFX?.event('enemySend');
        spawnFleetPackets(node,action.target,actualSendCount,78);
    });
}, 1500);

let __lastHudRefresh = 0;
function gameLoop(now=performance.now()) {
    telemetryFrameTick();
    adaptivePerfTick(now);
    let MAIN_C = THEMES[currentThemeIdx].color;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    
    ctx.save();
    let isPlaying = (gameState === 'playing');
    __framePE = isPlaying ? protocolEffects() : null;
    
    // DOM writes every frame are expensive in Telegram WebView/Firefox.
    // HUD only needs a few updates per second; gameplay canvas still renders normally.
    if (now - __lastHudRefresh > 220) {
        __lastHudRefresh = now;
        let hudLevelEl = document.getElementById('hudLevel');
        let hudDMEl = document.getElementById('hudDM');
        let hudProtocolsEl = document.getElementById('hudProtocols');
        if (hudProtocolsEl) { const v=`PROTO: ${totalProtocolStacks()}`; if(hudProtocolsEl.textContent!==v) hudProtocolsEl.textContent=v; }
        if (hudLevelEl) { const mark=currentSectorEvent?.kind==='boss'?' [BOSS]':(currentSectorEvent?.kind==='event'?' *':''); const ffa=(window.currentLevelConfig?.botCount||1)>=2?` FFA${(window.currentLevelConfig.botCount||1)+1}`:''; const v=`СЕКТОР: ${String(currentLevel).padStart(3,'0')}${mark}${ffa}`; if(hudLevelEl.textContent!==v) hudLevelEl.textContent=v; }
        if (hudDMEl) {
            const v=(runMatter > 0 && isPlaying)?`✦ ${darkMatter} [RUN +${runMatter}]`:`✦ ${darkMatter}`;
            if(hudDMEl.textContent!==v) hudDMEl.textContent=v;
        }
    }

    if (isPlaying && screenShake > 0) { let dx = (Math.random() - 0.5) * 8; let dy = (Math.random() - 0.5) * 8; ctx.translate(dx, dy); screenShake--; }
    if (isPlaying) checkWinLoss();

    ctx.fillStyle = MAIN_C;
    celestialBodies.forEach(cb => { 
        ctx.globalAlpha = 0.1; ctx.beginPath(); ctx.arc(cb.x, cb.y, cb.r, 0, Math.PI * 2); ctx.stroke(); 
        if (isPlaying) cb.y += cb.speed; 
        if (cb.y > window.innerHeight + cb.r) { cb.y = -cb.r; cb.x = Math.random() * window.innerWidth; } 
    });
    stars.forEach(star => { 
        ctx.globalAlpha = star.size === 2 ? 0.8 : 0.4; ctx.fillRect(star.x, star.y, star.size, star.size); 
        if (isPlaying) star.y += star.speed; 
        if (star.y > window.innerHeight) { star.y = 0; star.x = Math.random() * window.innerWidth; } 
    });
    ctx.globalAlpha = 1.0;

    asteroids.forEach(ast => ast.draw(MAIN_C, isPlaying)); 
    wormholes.forEach(wh => wh.draw(MAIN_C, isPlaying)); 
    blackHoles.forEach(bh => bh.draw(MAIN_C, isPlaying));

    if (isDragging && selectedNodes.length > 0) {
        ctx.strokeStyle = `rgba(${parseInt(MAIN_C.slice(1,3),16)}, ${parseInt(MAIN_C.slice(3,5),16)}, ${parseInt(MAIN_C.slice(5,7),16)}, 0.5)`; 
        ctx.lineWidth = 2; ctx.setLineDash([5, 5]);
        selectedNodes.forEach(node => { ctx.beginPath(); ctx.moveTo(node.x, node.y); ctx.lineTo(currentX, currentY); ctx.stroke(); }); ctx.setLineDash([]);
    }

    for (let i = lasers.length - 1; i >= 0; i--) { 
        let l = lasers[i]; ctx.strokeStyle = `rgba(${parseInt(MAIN_C.slice(1,3),16)}, ${parseInt(MAIN_C.slice(3,5),16)}, ${parseInt(MAIN_C.slice(5,7),16)}, ${l.life})`; 
        ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(l.x1, l.y1); ctx.lineTo(l.x2, l.y2); ctx.stroke(); 
        if (isPlaying) l.life -= 0.1; 
        if (l.life <= 0) lasers.splice(i, 1); 
    }
    
    if (isPlaying) {
        for (let i = particles.length - 1; i >= 0; i--) { if (particles[i].update()) particles.splice(i, 1); else particles[i].draw(); }
        for (let i = units.length - 1; i >= 0; i--) { if (units[i].update()) units.splice(i, 1); else units[i].draw(MAIN_C); }
        for (let i = floatingTexts.length - 1; i >= 0; i--) { if (floatingTexts[i].update()) floatingTexts.splice(i, 1); else floatingTexts[i].draw(); }
    } else {
        particles.forEach(p => p.draw()); units.forEach(u => u.draw(MAIN_C)); floatingTexts.forEach(ft => ft.draw());
    }

    nodes.forEach(node => node.draw(MAIN_C, isPlaying));
    try { window.CosmeticsFX?.draw?.(ctx, MAIN_C, isPlaying); } catch(e){}

    ctx.restore(); __framePE=null; requestAnimationFrame(gameLoop);
}
// Initial state boot is deferred until the current UI layer is loaded.
// This prevents legacy menu renderers from drawing an old screen before the modern UI overrides are installed.
let __coreBootDone = false;
window.__bootGameStateCore = function(){
    if (__coreBootDone) return;
    __coreBootDone = true;

    // Finished runs have an explicit persisted route. Do not normalize them into the home screen here.
    // The current UI layer will prepare the next run and open SHOP as the only allowed landing screen.
    if (!runStarted && !runAwaitingDecision && !protocolChoicePending && !awaitingNextSector && (postRunShopPending || totalRuns > 0 || runNumber > 1)) {
        postRunShopPending = true;
        gameState='shop';
        const shop=document.getElementById('shopUI'); if(shop) shop.classList.add('open');
    }

    if (runStarted && runAwaitingDecision) {
        gameState='defeat'; const shop=document.getElementById('shopUI'); if(shop) shop.classList.remove('open');
        const title=document.getElementById('shopTitle'); if(title) title.textContent='>_СИГНАЛ ВТРАЧЕНО';
        const sub=document.getElementById('shopSubtitle'); if(sub) sub.textContent=`RUN #${runNumber} • СЕКТОР ${String(currentLevel).padStart(3,'0')}`;
        const stats=document.getElementById('runStats'); if(stats) stats.innerHTML=`<div>SECTOR: ${String(currentLevel).padStart(3,'0')}</div><div>RUN BANK: ${runMatter} ✦</div><div>BUILD: ${totalProtocolStacks()} STACKS</div>`;
        renderProtocolChoice(); renderMetaPanel(false); renderMonetizationPanel();
        const btn=document.getElementById('btnAction'); if(btn){btn.style.display='block';btn.disabled=false;btn.textContent=`ЗАВЕРШИТИ RUN // +${projectedRunPayout()} ✦`;}
    }
    else if (runStarted && protocolChoicePending) showPendingProtocolChoice();
    else if (runStarted && awaitingNextSector) showBetweenSectorReady();
    else if (runStarted) loadLevel(currentLevel);
    else if (!(postRunShopPending || (!runStarted && (totalRuns > 0 || runNumber > 1)))) showRunStart();

    try { pdParent.postMessage({ playdeck: { method: 'loading', value: 100 } }, '*'); } catch(e){}
    setTimeout(requestPlayDeckState,160);
};

gameLoop();
