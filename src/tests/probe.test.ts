import { it } from 'vitest';
import { MissionSimulator } from '../engine/SimulationState';
function rate(loc:'moon'|'mars', d:'easy'|'normal'|'hard', a:[number,number,number], n=60){
  let w=0; const why:Record<string,number>={};
  for(let i=0;i<n;i++){
    const s=new MissionSimulator(loc,4,d);
    s.setResourceAllocation({lifeSupportPower:a[0],radiationShieldPower:a[1],foodProductionPower:a[2]});
    let g=0; while(s.isMissionRunning()&&g++<400*30) s.step();
    if(s.getMissionResult()) w++; else { const t=s.getEvents().filter(e=>e.type==='failure').pop()?.title??'?'; why[t]=(why[t]??0)+1;}
  }
  return `${loc} ${d} ${a.join('/')}: ${(w/n*100).toFixed(0)}% ${JSON.stringify(why)}`;
}
it('probe',()=>{
  const out:string[]=[];
  for(const a of [[40,40,20],[30,50,20],[25,50,25],[20,60,20],[30,60,10],[10,70,20]] as [number,number,number][]) out.push(rate('moon','normal',a));
  for(const a of [[40,40,20],[35,45,20],[30,50,20],[30,60,10],[40,30,20]] as [number,number,number][]) out.push(rate('mars','normal',a));
  console.log(out.join('\n'));
},120000);
