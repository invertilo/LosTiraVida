import { it } from 'vitest';
import { MissionSimulator } from '../engine/SimulationState';
import { vi } from 'vitest';
it('p',()=>{ vi.spyOn(Math,'random').mockReturnValue(0.99);
  const s=new MissionSimulator('moon',4,'normal'); s.setResourceAllocation({lifeSupportPower:40,radiationShieldPower:40,foodProductionPower:20});
  let h=0; while(s.isMissionRunning()&&h<9000){ s.step(); h++; if(h%500===0){const st=s.getState(); console.log(h, JSON.stringify(st.resources), st.radiationExposure.toFixed(1), st.activeEffects.map(e=>e.kind).join(','));}}
  console.log('end',h, s.getEvents().filter(e=>e.type==='failure'));
});
