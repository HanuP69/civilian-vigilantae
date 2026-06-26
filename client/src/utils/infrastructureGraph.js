export const INFRASTRUCTURE_GRAPH = {
  pothole: {
    asset: 'Roadway Foundation',
    directImpact: 'Vehicle Wear & Damaged Suspension',
    cascadingRisk: 'Traffic Congestion / Secondary Accidents',
    vulnerability: 'School Zone Alert',
    icon: '🛣️'
  },
  water_leak: {
    asset: 'Main Water Line',
    directImpact: 'Soil Erosion & Road Washout',
    cascadingRisk: 'Water Supply Interruption',
    vulnerability: 'Critical Transit Corridor',
    icon: '💧'
  },
  streetlight: {
    asset: 'Grid Lighting Node',
    directImpact: 'Low Visibility & Blind Spots',
    cascadingRisk: 'Increased Crime Opportunity',
    vulnerability: 'Dense Residential Alleyways',
    icon: '💡'
  },
  waste: {
    asset: 'Sanitation Dump / Bin',
    directImpact: 'Pest Attraction & Odor Emissions',
    cascadingRisk: 'Disease Outbreak / Health Hazard',
    vulnerability: 'Public Park / School Vicinity',
    icon: '🗑️'
  },
  road_damage: {
    asset: 'Asphalt Subgrade',
    directImpact: 'Structurally Compromised Tarmac',
    cascadingRisk: 'Complete Road Closure / Detours',
    vulnerability: 'High-Speed Bypass',
    icon: '🧱'
  },
  drainage: {
    asset: 'Stormwater Sump & Culvert',
    directImpact: 'Localized Street Flooding & Standing Water',
    cascadingRisk: 'Foundation Water Ingress & Damage',
    vulnerability: 'Low-Lying Urban Slum',
    icon: '🌊'
  },
  other: {
    asset: 'General Municipal Property',
    directImpact: 'Minor Infrastructure Degradation',
    cascadingRisk: 'Public Nuisance',
    vulnerability: 'Civic Center Area',
    icon: '🔧'
  }
};
