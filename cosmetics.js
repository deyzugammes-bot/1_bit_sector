// 1-Bit Sector V4.4 — Signal Styles / readable compare flow
(() => {
  'use strict';
  const DEFAULT_OWNED={
    'style:classic':true,'capital:signal':true,'drone:vector':true,'trail:signal':true,'capture:ring':true
  };
  const DEFAULT_EQUIPPED={style:'classic',capital:'signal',drone:'vector',trail:'signal',capture:'ring'};
  let state={owned:{...DEFAULT_OWNED},equipped:{...DEFAULT_EQUIPPED},tab:'style'};
  let previewSelection='';

  const ITEMS=[
    {slot:'style',id:'classic',name:'CLASSIC',preview:'01',desc:'Чистий білий 1-bit сигнал.',free:true},
    {slot:'style',id:'amber',name:'AMBER CRT',preview:'AM',desc:'Теплий старий термінал.',cost:350},
    {slot:'style',id:'phosphor',name:'PHOSPHOR',preview:'PH',desc:'Зелений радарний фосфор.',gate:{type:'best',value:16,label:'REACH S016'}},
    {slot:'style',id:'void',name:'VOID LINK',preview:'VD',desc:'Холодний deep-space сигнал.',cost:500,gate:{type:'boss',value:3,label:'DEFEAT 3 WARDENS'}},
    {slot:'style',id:'glitch',name:'GLITCH ECHO',preview:'//',desc:'Нестабільний цифровий канал.',cost:700,gate:{type:'best',value:32,label:'REACH S032'}},

    {slot:'capital',id:'signal',name:'SIGNAL CORE',preview:'▲',desc:'Класичне ядро командування.',free:true},
    {slot:'capital',id:'fortress',name:'FORTRESS CORE',preview:'[▲]',desc:'Кутова захисна рама столиці.',cost:420},
    {slot:'capital',id:'prism',name:'PRISM CORE',preview:'△▲',desc:'Подвійне призматичне ядро.',gate:{type:'best',value:24,label:'REACH S024'}},
    {slot:'capital',id:'warden',name:'WARDEN ECHO',preview:'◎▲',desc:'Трофейна boss-сигнатура.',cost:650,gate:{type:'boss',value:5,label:'DEFEAT 5 WARDENS'}},

    {slot:'drone',id:'vector',name:'VECTOR',preview:'>▲',desc:'Базовий ударний силует.',free:true},
    {slot:'drone',id:'shard',name:'SHARD',preview:'>◇',desc:'Вузький швидкий профіль.',cost:280},
    {slot:'drone',id:'ring',name:'RING',preview:'>○',desc:'Кільцевий signal-drone.',gate:{type:'captures',value:120,label:'CAPTURE 120 NODES'}},
    {slot:'drone',id:'spike',name:'SPIKE',preview:'>✣',desc:'Агресивний late-run силует.',cost:480,gate:{type:'best',value:28,label:'REACH S028'}},

    {slot:'trail',id:'signal',name:'SIGNAL LINE',preview:'──>',desc:'Чіткий стандартний слід.',free:true},
    {slot:'trail',id:'dots',name:'DOT MATRIX',preview:'···>',desc:'Піксельний дискретний слід.',cost:180},
    {slot:'trail',id:'pulse',name:'PULSE TRACE',preview:'━□>',desc:'Ритмічний імпульсний слід.',gate:{type:'best',value:12,label:'REACH S012'}},
    {slot:'trail',id:'phase',name:'PHASE TRACE',preview:'= = >',desc:'Розірваний portal-style слід.',cost:350,gate:{type:'events',value:8,label:'CLEAR 8 ANOMALIES'}},

    {slot:'capture',id:'ring',name:'RING PULSE',preview:'◎',desc:'Класична хвиля захоплення.',free:true},
    {slot:'capture',id:'cross',name:'CROSS BURST',preview:'✚',desc:'Різкий тактичний спалах.',cost:220},
    {slot:'capture',id:'scan',name:'SCAN RIPPLE',preview:'≋',desc:'Скан-лінії після захоплення.',gate:{type:'captures',value:200,label:'CAPTURE 200 NODES'}},
    {slot:'capture',id:'void',name:'VOID SNAP',preview:'◇',desc:'Імплозія з deep-space рамкою.',cost:500,gate:{type:'best',value:36,label:'REACH S036'}}
  ];
  const SLOTS=[['style','STYLE'],['capital','CAPITAL'],['drone','DRONE'],['trail','TRAIL'],['capture','CAPTURE FX']];
  const STYLE_INDEX={classic:0,phosphor:1,amber:2,void:3,glitch:4};

  function load(){
    try{
      const raw=localStorage.getItem('1BitSave'); if(raw){const d=JSON.parse(raw);if(d.cosmetics&&typeof d.cosmetics==='object')state={...state,...d.cosmetics,owned:{...DEFAULT_OWNED,...(d.cosmetics.owned||{})},equipped:{...DEFAULT_EQUIPPED,...(d.cosmetics.equipped||{})}};
      else if(Number.isFinite(d.theme)&&d.theme>0){const legacy=['classic','phosphor','amber','void','glitch'][Math.min(4,d.theme)]||'classic';state.owned[`style:${legacy}`]=true;state.equipped.style=legacy;}}
    }catch(e){}
    apply();
    try { const m=document.getElementById('shopUI')?.dataset.mode; if(m==='start'||m==='end') renderMenuQuickNav(m); } catch(e){}
  }
  function exportState(){return {owned:{...state.owned},equipped:{...state.equipped},tab:state.tab};}
  function reset(){state={owned:{...DEFAULT_OWNED},equipped:{...DEFAULT_EQUIPPED},tab:'style'};apply();}
  function key(i){return `${i.slot}:${i.id}`;}
  function owned(i){return !!state.owned[key(i)];}
  function getEquipped(slot){return state.equipped[slot]||DEFAULT_EQUIPPED[slot];}
  function gateProgress(g){
    if(!g)return {ok:true,now:1};
    let now=0;if(g.type==='best')now=bestSector||0;else if(g.type==='boss')now=totalBosses||0;else if(g.type==='captures')now=lifetimeCaptured||0;else if(g.type==='events')now=totalEventsCleared||0;else if(g.type==='runs')now=totalRuns||0;
    return {ok:now>=g.value,now};
  }
  function apply(){
    const style=getEquipped('style'),idx=STYLE_INDEX[style]??0;
    try{currentThemeIdx=idx;applyThemeColor();}catch(e){}
    document.body.dataset.signalStyle=style;
    document.body.dataset.capitalSkin=getEquipped('capital');
    document.body.dataset.droneSkin=getEquipped('drone');
    document.body.dataset.trailSkin=getEquipped('trail');
    document.body.dataset.captureSkin=getEquipped('capture');
  }
  function summary(){return {owned:ITEMS.filter(owned).length,total:ITEMS.length};}
  function notify(text){try{window.PolishFX?.event('unlock');}catch(e){} const el=document.getElementById('sectorAlert');if(el){el.textContent=text;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),1300);}}
  function choose(i){
    const g=gateProgress(i.gate);
    if(owned(i)){
      state.equipped[i.slot]=i.id; window.GameTelemetry?.track?.('cosmetic_equip',{slot:i.slot,item:i.id,owned:true}); apply(); saveProgress(); render(true); try{window.PolishFX?.event('select');}catch(e){} return;
    }
    if(!g.ok){try{window.PolishFX?.event('error');}catch(e){} return;}
    const cost=i.cost||0;
    if(cost>0&&darkMatter<cost){try{window.PolishFX?.event('error');}catch(e){} return;}
    if(cost>0)darkMatter-=cost;
    state.owned[key(i)]=true; state.equipped[i.slot]=i.id; window.GameTelemetry?.track?.('cosmetic_purchase',{slot:i.slot,item:i.id,cost,dm_after:darkMatter}); apply(); saveProgress(); updateShopUI(); notify(`UNLOCK // ${i.name}`); render(true);
    try{renderMenuQuickNav(document.getElementById('shopUI')?.dataset.mode||'start');}catch(e){}
  }
  const STYLE_COLORS={classic:'#ffffff',amber:'#ffb347',phosphor:'#78ffad',void:'#9bbcff',glitch:'#ff62d7'};
  function card(i,selected){
    const isOwned=owned(i),eq=getEquipped(i.slot)===i.id,g=gateProgress(i.gate),cost=i.cost||0;
    let status='';
    if(eq)status='EQUIPPED';else if(isOwned)status='OWNED';else if(!g.ok)status=`${g.now}/${i.gate.value}`;else if(cost)status=`${cost} ✦`;else status='FREE';
    return `<button class="cosmetic-card ${eq?'equipped':''} ${selected?'selected':''} ${(!isOwned&&!g.ok)?'locked':''}" data-cos-preview="${i.slot}:${i.id}"><span class="cosmetic-preview">${i.preview}</span><span class="cosmetic-copy"><b>${i.name}</b></span><span class="cosmetic-action">${status}</span></button>`;
  }
  function previewBox(i,label,isAfter=false){
    const color=i?.slot==='style'?(STYLE_COLORS[i.id]||'currentColor'):'currentColor';
    return `<div class="cosmetic-compare-box ${isAfter?'after':''}" style="--preview-color:${color}"><small>${label}</small><div class="cosmetic-big-symbol">${i?.preview||'?'}</div><b>${i?.name||'UNKNOWN'}</b></div>`;
  }
  function detail(selected,current){
    if(!selected||!current)return '';
    const isOwned=owned(selected),eq=getEquipped(selected.slot)===selected.id,g=gateProgress(selected.gate),cost=selected.cost||0;
    let action='',disabled=false;
    if(eq){action='ВЖЕ ВСТАНОВЛЕНО';disabled=true;}
    else if(isOwned)action='ЕКІПІРУВАТИ';
    else if(!g.ok){action=`LOCKED // ${g.now}/${selected.gate.value}`;disabled=true;}
    else if(cost>0&&darkMatter<cost){action=`ПОТРІБНО ЩЕ ${cost-darkMatter} ✦`;disabled=true;}
    else if(cost>0)action=`ВІДКРИТИ // ${cost} ✦`;
    else action='ЗАБРАТИ';
    const gate=!isOwned&&selected.gate?`<div class="unlock-hint">UNLOCK // ${selected.gate.label}</div>`:'';
    return `<section class="choice-focus cosmetic-focus sim-focus">
      <div class="choice-focus-head"><span class="choice-icon">${selected.preview}</span><div><small>${selected.slot.toUpperCase()}</small><h2>${selected.name}</h2></div><span class="choice-price">${eq?'✓':isOwned?'OWNED':cost?`${cost} ✦`:'GOAL'}</span></div>
      <p class="choice-desc">${selected.desc}</p>
      <div class="sim-stage-wrap"><canvas class="sim-stage cosmetic-sim-stage" data-sim-cosmetic="${selected.slot}:${selected.id}" aria-label="Cosmetic preview"></canvas><span class="sim-live-badge">CURRENT → SELECTED</span></div>
      ${gate}<button class="choice-primary cosmetic-confirm" data-cos-confirm="${selected.slot}:${selected.id}" ${disabled?'disabled':''}>${action}</button>
    </section>`;
  }
  function render(open=true){
    const panel=document.getElementById('cosmeticsPanel');if(!panel)return;
    const tab=state.tab||'style',sum=summary();
    const visible=ITEMS.filter(i=>i.slot===tab);
    if(!visible.some(i=>i.id===previewSelection)) previewSelection=getEquipped(tab);
    const selected=visible.find(i=>i.id===previewSelection)||visible[0];
    const current=visible.find(i=>i.id===getEquipped(tab))||visible[0];
    const tabs=SLOTS.map(([id,label])=>`<button class="${tab===id?'active':''}" data-cos-tab="${id}">${label}</button>`).join('');
    const cards=visible.map(i=>{const isOwned=owned(i),eq=getEquipped(i.slot)===i.id,g=gateProgress(i.gate),cost=i.cost||0;let status=eq?'✓':isOwned?'OWNED':!g.ok?`${g.now}/${i.gate.value}`:cost?`${cost} ✦`:'FREE';return `<button class="simple-list-item ${eq?'owned':''} ${i.id===selected?.id?'selected':''}" data-cos-preview="${i.slot}:${i.id}"><span><b>${i.name}</b><small>${i.slot.toUpperCase()}</small></span><strong>${status}</strong></button>`;}).join('');
    panel.innerHTML=`<div class="panel-topline"><div><small>VISUAL LOADOUT // NO POWER</small><b>SIGNAL STYLES</b></div><strong>${sum.owned}/${sum.total}</strong></div>
      <div class="segmented-tabs cosmetic-tabs-clean">${tabs}</div>
      ${detail(selected,current)}
      <div class="list-caption">ВАРІАНТИ</div><div class="simple-list">${cards}</div>`;
    panel.classList.toggle('open',open);
    const cosSim=panel.querySelector('[data-sim-cosmetic]');
    if(cosSim&&selected&&current&&window.SimPreview){ window.SimPreview.cosmetic(cosSim,current,selected); }
    panel.querySelectorAll('[data-cos-tab]').forEach(b=>b.addEventListener('click',()=>{state.tab=b.dataset.cosTab;previewSelection='';render(true);try{window.PolishFX?.event('select');}catch(e){}}));
    panel.querySelectorAll('[data-cos-preview]').forEach(b=>b.addEventListener('click',()=>{const [slot,id]=b.dataset.cosPreview.split(':');if(slot===state.tab){previewSelection=id;render(true);try{window.PolishFX?.event('select');}catch(e){}}}));
    panel.querySelectorAll('[data-cos-confirm]').forEach(b=>b.addEventListener('click',()=>{const [slot,id]=b.dataset.cosConfirm.split(':');const item=ITEMS.find(i=>i.slot===slot&&i.id===id);if(item)choose(item);}));
  }
  window.CosmeticsSystem={ITEMS,exportState,reset,getEquipped,summary,render,apply,choose,owned,gateProgress,getState:()=>({owned:{...state.owned},equipped:{...state.equipped},tab:state.tab})};
  load();
})();
