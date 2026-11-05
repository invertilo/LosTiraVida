# Gameplay Guide

Master the art of survival in space. This guide explains all the mechanics and strategies for winning in the Space Mission Simulator.

## Overview

You are managing an outpost on the Moon or Mars. Your goal is to keep your crew alive and maintain all systems operational for as long as possible. Each decision you make affects resource consumption, crew morale, and system health.

## Game Phases

### Setup Phase
Configure your mission before launch:
- **Destination**: Choose between Moon (Hard) or Mars (Standard)
- **Crew Size**: Select 2-6 astronauts with different roles
- **Crew Composition**: Each role has unique needs and effects

### Mission Phase
Manage your outpost in real-time:
- Watch resource levels decline and recover
- Respond to events and emergencies
- Adjust resource allocations
- Assign crew to maintenance when systems fail
- Monitor crew morale and health
- Accumulate radiation exposure

## Destinations

### Mars (Standard Difficulty)
- **Day Length**: ~24.6 hours (realistic Martian sol)
- **Night Duration**: ~12.3 hours
- **Solar Output**: 590 W/m² (43% of Earth)
- **Surface radiation**: ~240 mSv/year dose equivalent (MSL/RAD; habitat shielding is modeled separately)
- **Characteristics**: Shorter nights, less radiation than Moon
- **Winning Strategy**: More stable power generation due to shorter nights

### Moon (Hard Difficulty)
- **Day/Night Cycle**: ~708.7 hours (29.53 Earth days)
- **Daylight / Night**: ~354.4 hours each (14.76 Earth days)
- **Solar Output**: 1,368 W/m² (peak, similar to Earth)
- **Surface radiation**: ~500 mSv/year dose equivalent (Chang'E-4 LND; habitat shielding is modeled separately)
- **Characteristics**: Two-week nights, higher radiation, extreme power challenges
- **Winning Strategy**: Battery management and radiation shielding are critical

## Crew Management

### Astronaut Roles

Each role has different resource consumption and skills:

| Role | O₂ Usage | Water Usage | Special Ability | Best For |
|------|----------|-------------|-----------------|----------|
| Commander | Normal (1.0x) | Normal (1.0x) | Leadership | Morale boost |
| Engineer | High (1.2x) | Normal (1.0x) | Repair expert | Maintenance |
| Scientist | Normal (1.0x) | Normal (1.0x) | Research | Food production |
| Doctor | Normal (1.0x) | High (1.3x) | Medical care | Stress reduction |

### Crew Morale & Stress

- **Morale** (0-100): Reflects crew happiness and effectiveness
  - Increases: Good resource levels, low stress
  - Decreases: Shortages, system failures, long work hours
  
- **Stress** (0-100): Reflects psychological strain
  - Increases: Emergencies, radiation exposure, system failures
  - Decreases: Rest time, stable conditions
  - **Critical**: When stress reaches 100, crew becomes non-functional

### Health Status

- **Healthy**: Normal operations
- **Fatigued**: Reduced efficiency after long work hours
- **Injured**: Requires medical attention
- **Critical**: Immediate life support needed

### Work Assignment

Assign crew to:
- **Rest**: Recover morale/stress, reduce O₂/water consumption
- **Maintenance**: Repair degraded systems (requires engineer roles)

## Resource Economy

### Oxygen (O₂)
- **Source**: Life support system (if powered)
- **Consumption**: ~0.84 kg/person/day base rate
- **Critical Threshold**: < 50 kg
- **Failure Condition**: 0 kg = mission over (within 1 hour)
- **Impact**: Depends on crew working hours and stress levels

### Water
- **Source**: Water reclamation system + contingency reserves
- **Consumption**: ~3.5 liters/person/day base rate
- **Critical Threshold**: < 150 liters
- **Failure Condition**: 0 liters = mission over
- **Medical Use**: Doctors use more water (1.3x multiplier)
- **Recycling**: System recovers ~85% of wastewater

### Food
- **Source**: Hydroponic systems + emergency rations
- **Consumption**: ~0.62 kg dry mass/person/day
- **Critical Threshold**: < 50 kg
- **Production**: Hydroponic garden produces ~20 kg/m²/year in the game's edible-food equivalent
- **Failure Condition**: 0 kg = mission over

### Power (Battery)
- **Capacity**: 20 kWh battery (half charged at start)
- **Generation**: Solar panels (day only on Mars/Moon)
- **Consumption**: Varies by allocations and systems
- **Critical Threshold**: < 2 kWh
- **Night Loss**: Batteries drain without solar generation
- **Impact**: All systems depend on power allocation

### CO₂ Storage
- **Source**: Crew respiration (~1.0 kg/person/day)
- **Capacity**: 200 kg emergency storage
- **Recovery**: Sabatier reactor can convert CO₂ to fuel
- **Failure**: System offline = CO₂ buildup = crew poisoning

## Power Allocation System

Distribute limited power to three main systems:

### 1. Life Support (0-100%)
Powers:
- Oxygen production
- Water reclamation
- Temperature control
- Pressure regulation

**Effect**: Low allocation → O₂/water consumption increases, crew gets sick
**Optimal**: 70-100% for stability

### 2. Radiation Shielding (0-100%)
Powers:
- Magnetic field generators or active shielding
- Reduces radiation exposure by up to 50%

**Effect**: Low allocation → Crew accumulates radiation faster
**Optimal**: 50% minimum (Mars), 80%+ (Moon)

### 3. Food Production (0-100%)
Powers:
- Hydroponic lights and climate
- Increases food generation rate

**Effect**: Low allocation → Must rely on emergency rations
**Optimal**: 30-50% (depends on crew size and reserves)

## System Status

Monitor six critical systems:

| System | Purpose | Failure Impact | Repair Priority |
|--------|---------|-----------------|-----------------|
| Life Support | O₂/CO₂/temperature | Crew dies in hours | ⭐⭐⭐ Critical |
| Power | Energy distribution | All systems fail | ⭐⭐⭐ Critical |
| Radiation Shield | Radiation protection | Cumulative health damage | ⭐⭐ High |
| Food Production | Food generation | Must use rations | ⭐ Medium |
| Communications | External contact | Cannot call for help | ⭐ Medium |
| Habitat Structure | Structural integrity | Catastrophic failure | ⭐⭐⭐ Critical |

### System Status Levels

- **Operational** (Green): 100% efficiency
- **Degraded** (Yellow): 50-99% efficiency, warning sign
- **Critical** (Orange): 0-49% efficiency, immediate failure risk
- **Offline** (Red): 0% efficiency, mission-critical systems must be repaired

## Events System

Random events challenge your decisions:

### Types of Events

#### Emergencies
- **Dust Storm** (Mars only): Reduces solar power generation
- **System Leak**: Oxygen/water loss
- **Equipment Failure**: Component breaks, needs repair
- **Medical Emergency**: Crew injury requires doctor attention
- **Radiation Spike**: Sudden exposure increase
- **Dust/Ice Accumulation**: Covers solar panels

#### Discoveries (Positive)
- **Rich Resource Deposit**: Extra water/minerals found
- **Scientific Breakthrough**: Improved efficiency
- **Communication Signal**: Morale boost from Earth contact

### Event Log

All events are logged with:
- **Timestamp**: Day and Hour
- **Type**: Success, Warning, Critical, Failure, or Discovery
- **Title**: Event name
- **Description**: Details and impact

Los eventos aplican sus efectos a la simulación: modifican generación solar, consumo o recuperación de recursos, radiación, cosechas y moral según el evento. Las alertas activas muestran el impacto y permiten abrir la estación correspondiente en Operaciones.

## Victory Conditions

### Survival Milestone
- Survive X days (target: 365+ Earth days or Mars sols)
- Keep crew alive and systems operational

### Resource Stability
- Maintain positive resources (not in deficit)
- All systems in operational status
- Crew morale above 50%

### Crew Health
- No critical health conditions
- Stress levels manageable
- Radiation exposure below the game's strict mission-year budget (50 mSv)

## Failure Conditions

Mission ends if:

1. **Life Support Failure**: Oxygen depleted (< 0 kg)
2. **Crew Death**: Any crew member in critical condition too long
3. **Radiation Limit**: Cumulative dose exceeds the game's strict 50 mSv mission-year budget. NASA's separate spaceflight career limit is 600 mSv.
4. **Habitat Catastrophe**: Structure completely offline
5. **Complete System Failure**: Multiple critical systems fail simultaneously

## Time and Cycle

### Time Units

- **1 Simulation Hour** = 1 Mars/Moon hour
- **1 Simulation Sol/Day** = 24.6 h on Mars; one 708.7 h day/night cycle on the Moon
- **Speed Control**: 1x, 2x, 4x simulation speed

### Day/Night Cycle

**Mars**: 
- Day: ~12.3 hours (solar generation)
- Night: ~12.3 hours (battery only)

**Moon**:
- Day: ~354.4 hours (14.76 Earth days) - continuous solar power
- Night: ~354.4 hours (14.76 Earth days) - zero solar power

## Strategy Guide

### Winning on Mars

1. **Early Game (Days 1-20)**
   - Keep Life Support at 80-100%
   - Set Radiation Shield to 50%
   - Food Production at 30% (build reserves)
   - Monitor power balance during night cycles

2. **Mid Game (Days 20-100)**
   - Establish stable power generation rhythm
   - Maintain crew morale (> 60%)
   - Repair degraded systems immediately
   - Build resource buffers (especially O₂ and water)

3. **Late Game (Days 100+)**
   - Fine-tune allocations for efficiency
   - Prepare for emergencies
   - Monitor radiation accumulation (< 1.6 mSv/day sustainable)
   - Plan crew rotations and rest

### Winning on Moon

1. **Critical Challenge**: Two-week night cycles
   - **Day 1-6**: Maximize solar power collection, charge batteries heavily
   - **Day 7-14**: Manage 20 kWh battery for entire night
   - Budget: ~1.4 kWh/hour baseline consumption
   
2. **Radiation Management**
   - Lunar surface radiation is higher (~500 vs ~240 mSv/year); habitat shielding reduces the dose received inside.
   - Run shielding at 80%+ during both day and night
   - Track cumulative exposure carefully

3. **Power Allocation During Night**
   - Reduce Food Production to 0% (not critical)
   - Maintain Life Support at 100%
   - Maintain Radiation Shield at 80%
   - Rest crew to reduce O₂/water consumption

### Quick Win Scenario (Mars)

**Target**: Survive 30 days with optimal efficiency

1. Start: 4 crew (1 commander, 1 engineer, 1 scientist, 1 doctor)
2. Set allocations to 80/50/30 (LS/Shield/Food)
3. Never let crew work > 8 hours/day
4. Repair any system at "critical" status immediately
5. Keep crew morale > 70%

**Result**: Should reach 30 days easily, 90+ days with good management

### Failure Analysis

If mission fails, check:

1. **Power Balance**: Is solar generation enough?
2. **Resource Consumption**: Is allocation too low?
3. **Crew Assignments**: Are people on rest or working too much?
4. **Emergency Response**: Did you miss a critical event?
5. **Radiation**: Is shielding at 0% while crew is stressed?

## Advanced Tips

### Resource Optimization
- Engineers are best for maintenance (highest repair efficiency)
- Scientists boost food production (higher hydroponic yield)
- Doctors reduce crew stress (important for morale)
- Minimize crew working hours when possible

### Power Management
- Calculate: Solar generation during day = Battery charge rate
- Example (Mars): 3 kWh/hour generation vs 1.5 kWh/hour consumption = 1.5 kWh/hour surplus during day
- Use surplus to charge battery for night use

### Crew Morale
- High morale = higher efficiency, lower stress generation
- Ensure adequate sleep and low-stress conditions
- Rotate crew assignments to prevent fatigue

### Radiation Protection
- Higher allocation to shielding = lower accumulated dose
- Moon is harder due to higher baseline radiation
- NASA's career limit is 600 mSv; the game uses a stricter 50 mSv mission-year challenge

## Model notes

- NASA reports a 600 mSv total career limit for spaceflight. The 50 mSv/year objective is a stricter game challenge, not the NASA career limit.
- The lunar habitat shielding factor is a gameplay design assumption. Surface dose inputs are based on Chang'E-4 LND and MSL/RAD measurements.
- Hydroponic yield is a simplified edible-mass game parameter; NASA crop studies report species-specific fresh and dry mass yields.

## Resources

- NASA Life Support Systems: [NASA ECLSS](https://www.nasa.gov/)
- Lunar Base Planning: [NASA Moon to Mars](https://www.nasa.gov/)
- Mars Outpost Data: [NASA MAVEN Mission](https://www.nasa.gov/)
- Real Astronaut Data: Compiled from public NASA mission archives

---

**Good luck, Mission Commander!** The survival of your crew depends on your decisions. ✨
