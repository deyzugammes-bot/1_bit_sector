// 1-Bit Sector V3.5 — Visual Readability Pass
(() => {
  'use strict';

  const mainCanvas = document.getElementById('gameCanvas');
  const backdrop = document.createElement('canvas');
  backdrop.id = 'backdropCanvas';
  backdrop.setAttribute('aria-hidden','true');
  mainCanvas.parentNode.insertBefore(backdrop, mainCanvas);
  const bg = backdrop.getContext('2d');
  let bw = 0, bh = 0, bdpr = 1;
  let bgStars = [], dust = [];

  function rgb(hex){
    const h=(hex||'#ffffff').replace('#','');
    return {r:parseInt(h.slice(0,2),16)||255,g:parseInt(h.slice(2,4),16)||255,b:parseInt(h.slice(4,6),16)||255};
  }
  function rgba(hex,a){ const c=rgb(hex); return `rgba(${c.r},${c.g},${c.b},${a})`; }
  function theme(){ try{return THEMES[currentThemeIdx].color;}catch(e){return '#ffffff';} }
  function cosmetic(slot,fallback){ try{return window.CosmeticsSystem?.getEquipped?.(slot)||fallback;}catch(e){return fallback;} }

  function resizeBackdrop(){
    bdpr=Math.min(window.devicePixelRatio||1,2); bw=window.innerWidth; bh=window.innerHeight;
    backdrop.width=Math.floor(bw*bdpr); backdrop.height=Math.floor(bh*bdpr);
    backdrop.style.width=bw+'px'; backdrop.style.height=bh+'px';
    bg.setTransform(bdpr,0,0,bdpr,0,0);
    bgStars=[]; dust=[];
    const lowPower=((navigator.deviceMemory||4)<=2)||((navigator.hardwareConcurrency||8)<=4);
    const count=Math.min(lowPower?100:150,Math.max(lowPower?55:75,Math.floor((bw*bh)/(lowPower?9000:6500))));
    for(let i=0;i<count;i++){
      const layer=Math.random();
      bgStars.push({x:Math.random()*bw,y:Math.random()*bh,s:layer>.86?2:1,a:.15+layer*.55,v:.02+layer*.12,phase:Math.random()*6.28});
    }
    for(let i=0;i<14;i++) dust.push({x:Math.random()*bw,y:Math.random()*bh,len:8+Math.random()*28,a:.03+Math.random()*.06});
  }
  resizeBackdrop(); window.addEventListener('resize',resizeBackdrop);

  // Replace old foreground stars; the new backdrop owns space depth.
  try {
    initStars = function(){ stars=[]; celestialBodies=[]; };
    stars=[]; celestialBodies=[];
  } catch(e){}

  function eventGlyph(t,color){
    let ev=null; try{ev=currentSectorEvent;}catch(e){}
    if(!ev || ev.kind==='normal') return;
    bg.save(); bg.translate(bw*.5,bh*.54); bg.strokeStyle=rgba(color, ev.kind==='boss'?.09:.045); bg.lineWidth=1;
    const pulse=(Math.sin(t*.0018)+1)*.5;
    if(ev.kind==='boss'){
      for(let i=0;i<5;i++){
        const r=90+i*38+pulse*8;
        bg.setLineDash(i%2?[4,12]:[18,10]); bg.beginPath(); bg.arc(0,0,r,0,Math.PI*2); bg.stroke();
      }
      bg.setLineDash([]);
      for(let i=0;i<8;i++){
        const a=t*.00008+i*Math.PI/4, r=240;
        bg.beginPath(); bg.moveTo(Math.cos(a)*r,Math.sin(a)*r); bg.lineTo(Math.cos(a)*(r+26),Math.sin(a)*(r+26)); bg.stroke();
      }
    } else {
      bg.setLineDash([3,14]);
      for(let i=0;i<3;i++){ bg.beginPath(); bg.arc(0,0,120+i*70+pulse*5,0,Math.PI*2); bg.stroke(); }
      bg.setLineDash([]);
    }
    bg.restore();
  }

  let backdropLastFrame=0;
  const backdropFrameMs=((navigator.deviceMemory||4)<=2||(navigator.hardwareConcurrency||8)<=4)?50:33;
  function drawBackdrop(t){
    if(document.hidden){ requestAnimationFrame(drawBackdrop); return; }
    if(t-backdropLastFrame<backdropFrameMs){ requestAnimationFrame(drawBackdrop); return; }
    backdropLastFrame=t;
    const c=theme(); bg.clearRect(0,0,bw,bh);
    bg.fillStyle='#020303'; bg.fillRect(0,0,bw,bh);

    // Subtle tactical grid.
    bg.save(); bg.strokeStyle=rgba(c,.035); bg.lineWidth=1;
    const grid=48, ox=(t*.002)%grid, oy=(t*.003)%grid;
    for(let x=-grid+ox;x<bw+grid;x+=grid){bg.beginPath();bg.moveTo(x,0);bg.lineTo(x,bh);bg.stroke();}
    for(let y=-grid+oy;y<bh+grid;y+=grid){bg.beginPath();bg.moveTo(0,y);bg.lineTo(bw,y);bg.stroke();}
    bg.restore();

    // Long scan vectors / dust.
    bg.save(); bg.strokeStyle=rgba(c,.08); bg.lineWidth=1;
    dust.forEach(d=>{ bg.globalAlpha=d.a; bg.beginPath(); bg.moveTo(d.x,d.y); bg.lineTo(d.x+d.len,d.y-d.len*.22); bg.stroke(); });
    bg.restore();

    // Multi-depth stars.
    bg.fillStyle=c;
    bgStars.forEach(s=>{
      const tw=.65+.35*Math.sin(t*.001+s.phase);
      bg.globalAlpha=s.a*tw; bg.fillRect(Math.round(s.x),Math.round(s.y),s.s,s.s);
      if(gameState==='playing'){
        s.y+=s.v; if(s.y>bh){s.y=0;s.x=Math.random()*bw;}
      }
    }); bg.globalAlpha=1;

    eventGlyph(t,c);

    // Edge vignette.
    const g=bg.createRadialGradient(bw*.5,bh*.48,Math.min(bw,bh)*.18,bw*.5,bh*.48,Math.max(bw,bh)*.72);
    g.addColorStop(0,'rgba(0,0,0,0)'); g.addColorStop(1,'rgba(0,0,0,.64)');
    bg.fillStyle=g; bg.fillRect(0,0,bw,bh);
    requestAnimationFrame(drawBackdrop);
  }
  requestAnimationFrame(drawBackdrop);

  function polygon(ctx,n,r,rot=-Math.PI/2){
    ctx.beginPath(); for(let i=0;i<n;i++){const a=rot+i*Math.PI*2/n,x=Math.cos(a)*r,y=Math.sin(a)*r;i?ctx.lineTo(x,y):ctx.moveTo(x,y);} ctx.closePath();
  }
  function ownerShape(ctx,owner,r){
    if(owner===1) polygon(ctx,3,r,-Math.PI/2);
    else if(owner===2) polygon(ctx,4,r,-Math.PI/2);
    else if(owner===3) polygon(ctx,4,r,-Math.PI/4);
    else if(owner===4) polygon(ctx,6,r,0);
    else {ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);}
  }
  function ringTicks(ctx,r,count,color,alpha=.45,rot=0){
    ctx.save();ctx.rotate(rot);ctx.strokeStyle=color;ctx.globalAlpha=alpha;ctx.lineWidth=1;
    for(let i=0;i<count;i++){const a=i*Math.PI*2/count;ctx.beginPath();ctx.moveTo(Math.cos(a)*r,Math.sin(a)*r);ctx.lineTo(Math.cos(a)*(r+5),Math.sin(a)*(r+5));ctx.stroke();}
    ctx.restore();ctx.globalAlpha=1;
  }

  function drawPlayerDrone(ctx,skin,body,filled=true){
    ctx.beginPath();
    if(skin==='shard'){
      ctx.moveTo(body+4,0);ctx.lineTo(-body*.35,body*.55);ctx.lineTo(-body,body*.2);ctx.lineTo(-body*.55,0);ctx.lineTo(-body,-body*.2);ctx.lineTo(-body*.35,-body*.55);ctx.closePath();
      filled?ctx.fill():ctx.stroke();
    }else if(skin==='ring'){
      ctx.beginPath();ctx.arc(-1,0,body*.72,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(body+3,0);ctx.lineTo(body*.25,body*.42);ctx.lineTo(body*.25,-body*.42);ctx.closePath();filled?ctx.fill():ctx.stroke();
    }else if(skin==='spike'){
      ctx.moveTo(body+4,0);ctx.lineTo(0,body*.42);ctx.lineTo(-body*.6,body);ctx.lineTo(-body*.42,body*.25);ctx.lineTo(-body*1.05,0);ctx.lineTo(-body*.42,-body*.25);ctx.lineTo(-body*.6,-body);ctx.lineTo(0,-body*.42);ctx.closePath();filled?ctx.fill():ctx.stroke();
    }else{
      ctx.moveTo(body+3,0);ctx.lineTo(-1.5,body*.72);ctx.lineTo(-body*.8,0);ctx.lineTo(-1.5,-body*.72);ctx.closePath();filled?ctx.fill():ctx.stroke();
    }
  }
  function drawDefenseDrone(ctx, owner, opts={}){
    const filled=owner===1, elite=!!opts.elite, pulse=opts.pulse||0;
    const body=4.5+(elite?1.1:0)+pulse*.15;
    ctx.lineWidth=1.3;ctx.strokeStyle=theme();ctx.fillStyle=theme();
    if(owner===1){
      drawPlayerDrone(ctx,cosmetic('drone','vector'),body,true);
      ctx.fillStyle='#000';ctx.fillRect(-1.4,-1,2.8,2);
    }else if(owner===2){ctx.beginPath();ctx.rect(-body*.72,-body*.72,body*1.45,body*1.45);ctx.stroke();ctx.beginPath();ctx.moveTo(body*.72,0);ctx.lineTo(body*1.55,0);ctx.stroke();}
    else if(owner===3){polygon(ctx,4,body,-Math.PI/4);ctx.stroke();ctx.beginPath();ctx.moveTo(body*.72,0);ctx.lineTo(body*1.5,0);ctx.stroke();}
    else if(owner===4){polygon(ctx,6,body*.9,0);ctx.stroke();ctx.beginPath();ctx.moveTo(body*.82,0);ctx.lineTo(body*1.55,0);ctx.stroke();}
    else{ctx.setLineDash([2,2]);ctx.beginPath();ctx.arc(0,0,body*.85,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);}
    ctx.globalAlpha=.35;ctx.beginPath();ctx.moveTo(-body*.95,-1.5);ctx.lineTo(-body*1.8,-1.5);ctx.moveTo(-body*.95,1.5);ctx.lineTo(-body*1.55,1.5);ctx.stroke();ctx.globalAlpha=1;
    if(elite){ctx.globalAlpha=.45;ctx.beginPath();ctx.arc(0,0,body+2.2,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;}
  }

  AsteroidField.prototype.draw=function(MAIN_C,isPlaying){
    // V3.5: keep the collision field large, but render a sparse set of clearly separated rocks.
    if(!this._v35rocks){
      const picked=[];
      const candidates=this.rocks.slice().sort((a,b)=>{
        const aa=Math.atan2(a.y-this.y,a.x-this.x), bb=Math.atan2(b.y-this.y,b.x-this.x);
        return aa-bb;
      });
      for(const rock of candidates){
        if(picked.length>=7) break;
        const ok=picked.every(p=>Math.hypot(p.x-rock.x,p.y-rock.y)>16);
        if(ok) picked.push(rock);
      }
      if(picked.length<4){
        for(const rock of candidates){
          if(picked.includes(rock)) continue;
          picked.push(rock);
          if(picked.length>=4) break;
        }
      }
      this._v35rocks=picked;
    }
    const t=performance.now();
    ctx.save();
    ctx.strokeStyle=rgba(MAIN_C,.13);ctx.lineWidth=1;ctx.setLineDash([2,10]);
    ctx.beginPath();ctx.arc(this.x,this.y,this.r,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
    for(let k=0;k<3;k++){
      const a=t*.00008+k*Math.PI*2/3;
      const rr=this.r+3;
      ctx.strokeStyle=rgba(MAIN_C,.10);
      ctx.beginPath();ctx.moveTo(this.x+Math.cos(a)*rr,this.y+Math.sin(a)*rr);
      ctx.lineTo(this.x+Math.cos(a)*(rr+7),this.y+Math.sin(a)*(rr+7));ctx.stroke();
    }
    this._v35rocks.forEach((rock,idx)=>{
      ctx.save();ctx.translate(rock.x,rock.y);
      const spin=(idx%2?1:-1)*(idx*.31+(isPlaying?t*.00012:0));
      ctx.rotate(spin);
      ctx.strokeStyle=rgba(MAIN_C,.68);ctx.lineWidth=1.1;
      ctx.beginPath();rock.pts.forEach((pt,i)=>i?ctx.lineTo(pt.x,pt.y):ctx.moveTo(pt.x,pt.y));ctx.closePath();ctx.stroke();
      if(rock.pts.length>=4){
        ctx.strokeStyle=rgba(MAIN_C,.24);
        ctx.beginPath();ctx.moveTo(rock.pts[0].x,rock.pts[0].y);ctx.lineTo(rock.pts[2].x,rock.pts[2].y);ctx.stroke();
      }
      ctx.restore();
    });
    ctx.fillStyle=rgba(MAIN_C,.32);ctx.font='7px monospace';ctx.textAlign='center';
    ctx.fillText('DEBRIS FIELD',this.x,this.y-this.r-7);
    ctx.restore();
  };

  Wormhole.prototype.draw=function(MAIN_C,isPlaying){
    if(isPlaying)this.angle-=.035;
    ctx.save();ctx.translate(this.x,this.y);ctx.strokeStyle=MAIN_C;
    for(let k=0;k<3;k++){
      ctx.save();ctx.rotate(this.angle*(k%2?-.7:1)+k*.42);ctx.globalAlpha=.85-k*.18;ctx.lineWidth=k===0?2:1;
      polygon(ctx,8-k*2,20-k*5,Math.PI/8);ctx.stroke();ctx.restore();
    }
    ctx.globalAlpha=.25;ctx.beginPath();ctx.arc(0,0,27+Math.sin(performance.now()*.004)*2,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;
    ctx.fillStyle=MAIN_C;ctx.fillRect(-2,-2,4,4);
    ctx.restore();
    if(this.twin && this.x<this.twin.x){ctx.save();ctx.strokeStyle=rgba(MAIN_C,.08);ctx.setLineDash([2,10]);ctx.beginPath();ctx.moveTo(this.x,this.y);ctx.lineTo(this.twin.x,this.twin.y);ctx.stroke();ctx.restore();}
  };

  BlackHole.prototype.draw=function(MAIN_C,isPlaying){
    if(isPlaying)this.angle-=.018;
    const t=performance.now();
    if(!this._v35fragments){
      let seed=((Math.floor(this.x*31)+Math.floor(this.y*17)+Math.floor(this.radius*13))>>>0)||1;
      const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
      this._v35fragments=Array.from({length:7},(_,i)=>({
        a:rnd()*Math.PI*2,
        rr:this.radius*(.82+rnd()*.50),
        squash:.46+rnd()*.20,
        speed:(.45+rnd()*.75)*(i%2?1:-1),
        size:2.5+rnd()*4,
        phase:rnd()*Math.PI*2,
        tri:rnd()>.45
      }));
    }

    ctx.save();ctx.translate(this.x,this.y);
    const pulse=.5+.5*Math.sin(t*.0032);
    const glow=ctx.createRadialGradient(0,0,this.radius*.08,0,0,this.radius*1.28);
    glow.addColorStop(0,'rgba(0,0,0,1)');
    glow.addColorStop(.50,'rgba(0,0,0,.99)');
    glow.addColorStop(.69,rgba(MAIN_C,.055+.035*pulse));
    glow.addColorStop(.82,rgba(MAIN_C,.025));
    glow.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=glow;ctx.beginPath();ctx.arc(0,0,this.radius*1.28,0,Math.PI*2);ctx.fill();

    ctx.save();ctx.rotate(this.angle);
    for(let i=0;i<3;i++){
      const rr=this.radius*(.68+i*.16);
      ctx.strokeStyle=rgba(MAIN_C,.28-i*.055+.08*pulse);
      ctx.lineWidth=i===0?1.6:1;
      ctx.beginPath();
      ctx.ellipse(0,0,rr,rr*(.44+i*.07),i*.42,.18+i*.35,Math.PI*1.36+i*.22);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(0,0,rr,rr*(.44+i*.07),i*.42,Math.PI+.35+i*.2,Math.PI*1.78+i*.22);
      ctx.stroke();
    }
    ctx.restore();

    this._v35fragments.forEach((f,idx)=>{
      const a=f.a+this.angle*f.speed*2.2;
      const wobble=1+Math.sin(t*.0018+f.phase)*.055;
      const rr=f.rr*wobble;
      const x=Math.cos(a)*rr, y=Math.sin(a)*rr*f.squash;
      const behind=Math.sin(a)<0;
      ctx.save();ctx.translate(x,y);ctx.rotate(a+t*.00035*(idx%2?1:-1));
      ctx.globalAlpha=behind?.24:.62;
      ctx.strokeStyle=MAIN_C;ctx.lineWidth=1;
      ctx.beginPath();
      if(f.tri){ctx.moveTo(f.size,0);ctx.lineTo(-f.size*.65,f.size*.55);ctx.lineTo(-f.size*.35,-f.size*.65);ctx.closePath();}
      else{ctx.rect(-f.size*.55,-f.size*.32,f.size*1.1,f.size*.64);}
      ctx.stroke();
      ctx.restore();
    });

    ctx.fillStyle='#000';ctx.beginPath();ctx.arc(0,0,this.radius*.43,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle=rgba(MAIN_C,.72);ctx.lineWidth=1;ctx.beginPath();ctx.arc(0,0,this.radius*(.44+.018*pulse),0,Math.PI*2);ctx.stroke();
    ctx.strokeStyle=rgba(MAIN_C,.18);
    for(let k=0;k<4;k++){
      const a=t*.00025+k*Math.PI/2, r=this.radius*.56;
      ctx.beginPath();ctx.moveTo(Math.cos(a)*r,Math.sin(a)*r);ctx.lineTo(Math.cos(a)*(r+5),Math.sin(a)*(r+5));ctx.stroke();
    }
    ctx.restore();

    if(isPlaying&&Math.random()<(((navigator.deviceMemory||4)<=2)?.12:.26))
      this.suckDots.push({d:this.radius*1.05,a:Math.random()*Math.PI*2});
    ctx.fillStyle=MAIN_C;
    for(let i=this.suckDots.length-1;i>=0;i--){
      const p=this.suckDots[i];
      if(isPlaying){p.d-=1.55;p.a+=.085+(1-p.d/Math.max(1,this.radius))*.08;}
      if(p.d<=2){if(isPlaying)this.suckDots.splice(i,1);continue;}
      ctx.globalAlpha=Math.min(.58,p.d/this.radius);
      ctx.fillRect(this.x+Math.cos(p.a)*p.d,this.y+Math.sin(p.a)*p.d,2,2);
    }
    ctx.globalAlpha=1;
  };


  // V5.9.25.2 — shared gameplay cosmetic primitives for the Cosmetics preview.
  // The real game and the preview call the same CAPITAL skin and DRONE drawing code.
  function drawPlayerCapitalSkin(ctx,skin,r,baseAngle=0,color=theme()){
    ctx.save();ctx.strokeStyle=color;ctx.lineWidth=1;ctx.globalAlpha=.55;
    if(skin==='fortress'){
      const q=r+12, len=8;
      [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx,sy])=>{ctx.beginPath();ctx.moveTo(sx*q,sy*(q-len));ctx.lineTo(sx*q,sy*q);ctx.lineTo(sx*(q-len),sy*q);ctx.stroke();});
    }else if(skin==='prism'){
      ctx.rotate(-baseAngle*.65);polygon(ctx,3,r+8,-Math.PI/2);ctx.stroke();ctx.rotate(baseAngle*1.3);polygon(ctx,3,r*.58,-Math.PI/2);ctx.stroke();
    }else if(skin==='warden'){
      ctx.setLineDash([6,4]);ctx.beginPath();ctx.arc(0,0,r+10,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ringTicks(ctx,r+14,12,color,.58,-baseAngle*.8);
    }else{
      ctx.beginPath();ctx.moveTo(0,-r-9);ctx.lineTo(0,-r-4);ctx.moveTo(r+4,0);ctx.lineTo(r+9,0);ctx.moveTo(-r-4,0);ctx.lineTo(-r-9,0);ctx.stroke();
    }
    ctx.restore();
  }

  function drawPlayerTrailPrimitive(c,style,color,now=performance.now(),alpha=1){
    c.save();c.strokeStyle=rgba(color,.50);c.fillStyle=rgba(color,.55);c.globalAlpha*=alpha;c.lineWidth=1;
    if(style==='dots'){
      c.fillRect(-9,-1,2,2);c.globalAlpha*=.72;c.fillRect(-14,-1,2,2);c.globalAlpha*=.62;c.fillRect(-19,-1,2,2);
    }else if(style==='pulse'){
      c.beginPath();c.moveTo(-7,0);c.lineTo(-20,0);c.stroke();const px=-13-Math.sin(now*.012)*4;c.fillRect(px-1,-2,3,4);
    }else if(style==='phase'){
      c.setLineDash([3,3]);c.beginPath();c.moveTo(-7,-2.5);c.lineTo(-22,-2.5);c.moveTo(-7,2.5);c.lineTo(-18,2.5);c.stroke();c.setLineDash([]);
    }else{
      c.beginPath();c.moveTo(-7,-2);c.lineTo(-16,-2);c.moveTo(-7,2);c.lineTo(-13,2);c.stroke();
    }
    c.restore();
  }

  function drawCapturePrimitive(c,style,color,age=0,life=1){
    if(life<=0)return;
    c.save();c.strokeStyle=color;c.fillStyle=color;c.globalAlpha=Math.max(0,life)*.85;c.lineWidth=1.4;const r=8+age*1.25;
    if(style==='cross'){
      c.beginPath();c.moveTo(-r,0);c.lineTo(r,0);c.moveTo(0,-r);c.lineTo(0,r);c.stroke();c.globalAlpha*=.45;c.strokeRect(-r*.55,-r*.55,r*1.1,r*1.1);
    }else if(style==='scan'){
      for(let k=-1;k<=1;k++){const yy=k*6+(age%8)-4;c.beginPath();c.moveTo(-r,yy);c.lineTo(r,yy);c.stroke();}c.globalAlpha*=.35;c.strokeRect(-r*.8,-r*.8,r*1.6,r*1.6);
    }else if(style==='void'){
      const rr=Math.max(4,30-age*.65);c.rotate(age*.05);c.strokeRect(-rr/2,-rr/2,rr,rr);c.rotate(Math.PI/4);c.strokeRect(-rr*.34,-rr*.34,rr*.68,rr*.68);
    }else{
      c.beginPath();c.arc(0,0,r,0,Math.PI*2);c.stroke();c.globalAlpha*=.45;c.beginPath();c.arc(0,0,r*.58,0,Math.PI*2);c.stroke();
    }
    c.restore();
  }

  window.GameCosmeticPreview={
    drawCapital(ctx,skin,droneSkin,color,x,y,opts={}){
      const r=opts.radius||20, baseAngle=opts.baseAngle||0, turretAngle=opts.turretAngle||0;
      ctx.save();ctx.translate(x,y);
      // Same player-capital language as the actual Node renderer.
      ctx.strokeStyle=rgba(color,.34);ctx.lineWidth=1;ctx.setLineDash([3,6]);ctx.beginPath();ctx.arc(0,0,r+11,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
      ringTicks(ctx,r+17,10,color,.26,baseAngle*.4);
      ctx.save();ctx.rotate(baseAngle);ownerShape(ctx,1,r);ctx.fillStyle=color;ctx.globalAlpha=.92;ctx.fill();ctx.globalAlpha=1;ctx.strokeStyle='#000';ctx.lineWidth=1;ctx.stroke();
      ctx.rotate(-baseAngle*1.8);ctx.globalAlpha=.7;ownerShape(ctx,1,Math.max(4,r*.42));ctx.lineWidth=1;ctx.strokeStyle='#000';ctx.stroke();ctx.globalAlpha=1;ctx.restore();
      for(let i=0;i<2;i++){
        const a=turretAngle+i*Math.PI, rr=r+15;
        ctx.save();ctx.translate(Math.cos(a)*rr,Math.sin(a)*rr);ctx.rotate(a);ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=1.3;
        drawPlayerDrone(ctx,droneSkin||'vector',5.6,true);ctx.fillStyle='#000';ctx.fillRect(-1.4,-1,2.8,2);
        ctx.globalAlpha=.45;ctx.strokeStyle=color;ctx.beginPath();ctx.arc(0,0,7.8,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;ctx.restore();
      }
      drawPlayerCapitalSkin(ctx,skin,r,baseAngle,color);
      ctx.restore();
    },
    drawDrone(ctx,skin,color,x,y,angle=0,body=5.2){
      ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=1.25;
      drawPlayerDrone(ctx,skin,body,true);ctx.fillStyle='#000';ctx.fillRect(-2.5,-1,3,2);ctx.restore();
    },
    drawTrail(ctx,skin,color,x,y,angle=0,now=performance.now(),alpha=1){
      ctx.save();ctx.translate(x,y);ctx.rotate(angle);drawPlayerTrailPrimitive(ctx,skin,color,now,alpha);ctx.restore();
    },
    drawCapture(ctx,style,color,x,y,age=0,life=1){
      ctx.save();ctx.translate(x,y);drawCapturePrimitive(ctx,style,color,age,life);ctx.restore();
    }
  };

  Node.prototype.draw=function(MAIN_C,isPlaying){
    if(isPlaying){
      if(this.laserCooldown>0)this.laserCooldown--;
      this.shootLaser();
      if(this.pulse>0)this.pulse-=.5;
      this.baseAngle+=.012;this.turretAngle+=.035;this.orbitAngle+=.012;
    }
    const r=this.radius+this.pulse, own=this.owner;
    ctx.save();ctx.translate(this.x,this.y);

    // Tactical halo communicates ownership and importance before the core shape.
    if(this.isCapital||this.isBoss){
      ctx.strokeStyle=rgba(MAIN_C,this.isBoss?.65:.34);ctx.lineWidth=1;
      ctx.setLineDash(this.isBoss?[10,5]:[3,6]);ctx.beginPath();ctx.arc(0,0,r+11,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
      ringTicks(ctx,r+17,this.isBoss?16:10,MAIN_C,this.isBoss?.62:.26,this.baseAngle*.4);
    }
    if(own===0){ctx.strokeStyle=rgba(MAIN_C,.2);ctx.setLineDash([2,5]);ctx.beginPath();ctx.arc(0,0,r+6,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);}

    ctx.save();ctx.rotate(this.baseAngle);
    ownerShape(ctx,own,r);
    if(own===1){ctx.fillStyle=MAIN_C;ctx.globalAlpha=.92;ctx.fill();ctx.globalAlpha=1;ctx.strokeStyle='#000';ctx.lineWidth=1;ctx.stroke();}
    else {ctx.strokeStyle=own===0?rgba(MAIN_C,.48):MAIN_C;ctx.lineWidth=own===2?2.5:1.5;if(own===0)ctx.setLineDash([4,4]);ctx.stroke();ctx.setLineDash([]);}
    // Inner core makes type differences visible without color.
    ctx.rotate(-this.baseAngle*1.8);ctx.globalAlpha=own===0?.28:.7;ownerShape(ctx,own,Math.max(4,r*.42));ctx.lineWidth=1;ctx.strokeStyle=own===1?'#000':MAIN_C;ctx.stroke();ctx.globalAlpha=1;
    ctx.restore();

    if(this.isCapital||this.type===2){
      const turretCount=this.isBoss?2+(this.bossTier||1):(this.isCapital?2:1);
      for(let i=0;i<turretCount;i++){
        const a=this.turretAngle+i*Math.PI*2/turretCount, rr=r+15, tx=Math.cos(a)*rr,ty=Math.sin(a)*rr;
        ctx.save();
        ctx.translate(tx,ty);
        ctx.rotate(a);
        ctx.globalAlpha=this.owner===0?.55:1;
        drawDefenseDrone(ctx, own, {elite:this.isBoss||this.isCapital, pulse:this.pulse||0});
        if(this.isBoss){
          ctx.strokeStyle=rgba(MAIN_C,.35);ctx.beginPath();ctx.arc(0,0,11+Math.sin(this.turretAngle+i)*1.2,0,Math.PI*2);ctx.stroke();
        }
        ctx.restore();
      }
    }

    if(own===1 && this.isCapital && !this.isBoss){
      drawPlayerCapitalSkin(ctx,cosmetic('capital','signal'),r,this.baseAngle,MAIN_C);
    }

    if(this.isBoss){
      const tier=this.bossTier||1;ctx.strokeStyle=MAIN_C;ctx.globalAlpha=.38;ctx.lineWidth=1;
      for(let k=0;k<tier+1;k++){ctx.setLineDash(k%2?[3,7]:[9,5]);ctx.beginPath();ctx.arc(0,0,r+25+k*7,0,Math.PI*2);ctx.stroke();}
      ctx.setLineDash([]);ctx.globalAlpha=1;ctx.fillStyle=MAIN_C;ctx.font='bold 8px monospace';ctx.textAlign='center';ctx.fillText(`WARDEN // T${tier}`,0,-r-27-tier*6);
    }

    const dots=Math.min(12,Math.floor(this.unitsCount/4));ctx.fillStyle=own===0?rgba(MAIN_C,.35):MAIN_C;
    for(let i=0;i<dots;i++){const a=this.orbitAngle+i*Math.PI*2/Math.max(1,dots), rr=r+7+(i%2)*3;ctx.globalAlpha=.45+(i%3)*.18;ctx.fillRect(Math.cos(a)*rr-1,Math.sin(a)*rr-1,2,2);}ctx.globalAlpha=1;

    if(selectedNodes.includes(this)){
      const sr=r+24;ctx.strokeStyle=MAIN_C;ctx.lineWidth=1;ctx.setLineDash([8,5]);ctx.beginPath();ctx.arc(0,0,sr,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
      ctx.beginPath();ctx.moveTo(-sr-7,0);ctx.lineTo(-sr+2,0);ctx.moveTo(sr-2,0);ctx.lineTo(sr+7,0);ctx.moveTo(0,-sr-7);ctx.lineTo(0,-sr+2);ctx.moveTo(0,sr-2);ctx.lineTo(0,sr+7);ctx.stroke();
    }

    // V3.5 / Variant A: unit count lives BELOW the object, leaving the planet/core visually clean.
    const count=own===0?'?':Math.max(0,Math.floor(this.unitsCount)).toString();
    const plateY=r+18;
    ctx.font='bold 12px monospace';ctx.textAlign='center';ctx.textBaseline='middle';
    const tw=Math.max(22,ctx.measureText(count).width+10), ph=15;
    ctx.strokeStyle=rgba(MAIN_C,own===0?.26:.52);ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(0,r+4);ctx.lineTo(0,plateY-ph/2-2);ctx.stroke();
    ctx.fillStyle='rgba(0,0,0,.88)';ctx.fillRect(-tw/2,plateY-ph/2,tw,ph);
    const c=4, lx=-tw/2, rx=tw/2, ty=plateY-ph/2, by=plateY+ph/2;
    ctx.beginPath();
    ctx.moveTo(lx+c,ty);ctx.lineTo(lx,ty);ctx.lineTo(lx,ty+c);
    ctx.moveTo(rx-c,ty);ctx.lineTo(rx,ty);ctx.lineTo(rx,ty+c);
    ctx.moveTo(lx+c,by);ctx.lineTo(lx,by);ctx.lineTo(lx,by-c);
    ctx.moveTo(rx-c,by);ctx.lineTo(rx,by);ctx.lineTo(rx,by-c);
    ctx.stroke();
    ctx.fillStyle=own===0?rgba(MAIN_C,.62):MAIN_C;ctx.fillText(count,0,plateY);
    ctx.restore();
  };

  Unit.prototype.draw=function(MAIN_C){
    ctx.save();ctx.globalAlpha=Math.max(0,this.alpha);ctx.translate(this.x,this.y);ctx.rotate(this.angle||0);
    const enemy=this.owner!==1;
    ctx.lineWidth=1;
    if(this.owner===1){
      drawPlayerTrailPrimitive(ctx,cosmetic('trail','signal'),MAIN_C,performance.now(),1);
    }else{
      ctx.strokeStyle=rgba(MAIN_C,.24);ctx.beginPath();ctx.moveTo(-7,-2);ctx.lineTo(-16,-2);ctx.moveTo(-7,2);ctx.lineTo(-13,2);ctx.stroke();
    }
    ctx.strokeStyle=MAIN_C;ctx.fillStyle=MAIN_C;ctx.lineWidth=1.25;
    if(this.owner===1){drawPlayerDrone(ctx,cosmetic('drone','vector'),5.2,true);ctx.fillStyle='#000';ctx.fillRect(-2.5,-1,3,2);}
    else if(this.owner===2){ctx.beginPath();ctx.moveTo(8,0);ctx.lineTo(0,4);ctx.lineTo(-6,2);ctx.lineTo(-2,0);ctx.lineTo(-6,-2);ctx.lineTo(0,-4);ctx.closePath();ctx.stroke();ctx.beginPath();ctx.moveTo(-6,2);ctx.lineTo(-9,5);ctx.moveTo(-6,-2);ctx.lineTo(-9,-5);ctx.stroke();}
    else if(this.owner===3){ctx.beginPath();ctx.moveTo(7,0);ctx.lineTo(1,4);ctx.lineTo(-5,4);ctx.lineTo(-2,0);ctx.lineTo(-5,-4);ctx.lineTo(1,-4);ctx.closePath();ctx.stroke();ctx.beginPath();ctx.moveTo(-2,0);ctx.lineTo(4,0);ctx.stroke();}
    else{polygon(ctx,6,4.5,0);ctx.stroke();ctx.beginPath();ctx.moveTo(4.5,0);ctx.lineTo(9,0);ctx.stroke();}
    ctx.restore();
  };

  const cosmeticBursts=[];
  window.CosmeticsFX={
    capture(x,y){cosmeticBursts.push({x,y,life:1,age:0,style:cosmetic('capture','ring')});},
    draw(c,color,isPlaying){
      for(let i=cosmeticBursts.length-1;i>=0;i--){const b=cosmeticBursts[i];if(isPlaying){b.life-=.028;b.age+=1;}if(b.life<=0){cosmeticBursts.splice(i,1);continue;}c.save();c.translate(b.x,b.y);drawCapturePrimitive(c,b.style,color,b.age,b.life);c.restore();}
    }
  };

  Particle.prototype.draw=function(){
    ctx.save();ctx.globalAlpha=Math.max(0,this.life);ctx.fillStyle=theme();ctx.fillRect(Math.round(this.x),Math.round(this.y),2,2);ctx.globalAlpha*=.35;ctx.fillRect(Math.round(this.x-this.vx*2),Math.round(this.y-this.vy*2),1,1);ctx.restore();
  };

  // Small visual signature in the menu without adding image assets.
  const title=document.getElementById('shopTitle');
  if(title) title.dataset.visual='V3.5';
})();
