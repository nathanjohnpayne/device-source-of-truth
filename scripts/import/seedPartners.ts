import { getFirestore } from 'firebase-admin/firestore';

interface Partner {
  id: string;
  name: string;
  parentId: string | null;
  country: string | null;
  region: string | null;
  entityType: string;
  serviceType: string;
  status: 'Current' | 'Sold' | 'Discontinued' | 'Spun off';
  notes: string;
}

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

const partners: Partner[] = [
  // TOP LEVEL
  {
    id: slugify('Liberty Global'),
    name: 'Liberty Global',
    parentId: null,
    country: null,
    region: null,
    entityType: 'Parent Company',
    serviceType: 'Cable/Media conglomerate',
    status: 'Current',
    notes: 'Pan-European cable and media group',
  },

  // DIRECT CHILDREN OF liberty-global
  {
    id: slugify('Virgin Media O2'),
    name: 'Virgin Media O2',
    parentId: slugify('Liberty Global'),
    country: 'UK',
    region: 'EMEA',
    entityType: 'JV (50% Liberty Global / 50% Telefónica)',
    serviceType: 'Fixed+Mobile+TV',
    status: 'Current',
    notes: 'Converged UK operator',
  },
  {
    id: slugify('VodafoneZiggo'),
    name: 'VodafoneZiggo',
    parentId: slugify('Liberty Global'),
    country: 'Netherlands',
    region: 'EMEA',
    entityType: 'JV (50% Liberty Global / 50% Vodafone)',
    serviceType: 'Fixed+Mobile+TV',
    status: 'Current',
    notes: 'National converged operator',
  },
  {
    id: slugify('Telenet'),
    name: 'Telenet',
    parentId: slugify('Liberty Global'),
    country: 'Belgium',
    region: 'EMEA',
    entityType: 'Subsidiary',
    serviceType: 'Fixed+Mobile+TV',
    status: 'Current',
    notes: 'Flanders cable/mobile operator',
  },
  {
    id: slugify('Virgin Media Ireland'),
    name: 'Virgin Media Ireland',
    parentId: slugify('Liberty Global'),
    country: 'Ireland',
    region: 'EMEA',
    entityType: 'Subsidiary',
    serviceType: 'Fixed+Mobile+TV',
    status: 'Current',
    notes: 'National cable operator',
  },
  {
    id: slugify('Sunrise / Sunrise UPC'),
    name: 'Sunrise / Sunrise UPC',
    parentId: slugify('Liberty Global'),
    country: 'Switzerland',
    region: 'EMEA',
    entityType: 'Former subsidiary',
    serviceType: 'Fixed+Mobile+TV',
    status: 'Spun off',
    notes: 'Now independent public company (2024)',
  },
  {
    id: slugify('UPC Broadband'),
    name: 'UPC Broadband',
    parentId: slugify('Liberty Global'),
    country: null,
    region: 'EMEA',
    entityType: 'Umbrella brand',
    serviceType: 'Cable/ISP brand',
    status: 'Discontinued',
    notes: 'Master brand for regional UPCs',
  },
  {
    id: slugify('Unitymedia'),
    name: 'Unitymedia',
    parentId: slugify('Liberty Global'),
    country: 'Germany',
    region: 'EMEA',
    entityType: 'Subsidiary',
    serviceType: 'Fixed broadband/TV',
    status: 'Sold',
    notes: 'Sold to Vodafone 2019',
  },
  {
    id: slugify('Unitymedia Austria'),
    name: 'Unitymedia Austria',
    parentId: slugify('Liberty Global'),
    country: 'Austria',
    region: 'EMEA',
    entityType: 'Subsidiary',
    serviceType: 'Fixed broadband/TV',
    status: 'Sold',
    notes: 'Rebranded/sold',
  },
  {
    id: slugify('Get'),
    name: 'Get',
    parentId: slugify('Liberty Global'),
    country: 'Norway',
    region: 'EMEA',
    entityType: 'Subsidiary',
    serviceType: 'Fixed broadband/TV',
    status: 'Sold',
    notes: 'Merged into Telia',
  },

  // CHILDREN OF virgin-media-o2
  {
    id: slugify('Virgin Media'),
    name: 'Virgin Media',
    parentId: slugify('Virgin Media O2'),
    country: 'UK',
    region: 'EMEA',
    entityType: 'Brand',
    serviceType: 'Fixed broadband/TV/Phone',
    status: 'Current',
    notes: 'Consumer cable/fiber brand',
  },
  {
    id: slugify('O2'),
    name: 'O2',
    parentId: slugify('Virgin Media O2'),
    country: 'UK',
    region: 'EMEA',
    entityType: 'Brand',
    serviceType: 'Mobile network',
    status: 'Current',
    notes: 'Major UK mobile carrier',
  },
  {
    id: slugify('giffgaff'),
    name: 'giffgaff',
    parentId: slugify('Virgin Media O2'),
    country: 'UK',
    region: 'EMEA',
    entityType: 'MVNO',
    serviceType: 'MVNO mobile',
    status: 'Current',
    notes: 'Digital-first sub-brand',
  },
  {
    id: slugify('Tesco Mobile UK'),
    name: 'Tesco Mobile UK',
    parentId: slugify('Virgin Media O2'),
    country: 'UK',
    region: 'EMEA',
    entityType: 'Network partner',
    serviceType: 'MVNO mobile',
    status: 'Current',
    notes: 'Joint venture with Tesco',
  },

  // CHILDREN OF vodafoneziggo
  {
    id: slugify('Ziggo'),
    name: 'Ziggo',
    parentId: slugify('VodafoneZiggo'),
    country: 'Netherlands',
    region: 'EMEA',
    entityType: 'Brand',
    serviceType: 'Cable broadband/TV',
    status: 'Current',
    notes: 'Primary fixed-line brand',
  },
  {
    id: slugify('Vodafone Netherlands'),
    name: 'Vodafone Netherlands',
    parentId: slugify('VodafoneZiggo'),
    country: 'Netherlands',
    region: 'EMEA',
    entityType: 'Brand',
    serviceType: 'Mobile network',
    status: 'Current',
    notes: 'Mobile services',
  },
  {
    id: slugify('Ziggo Sport'),
    name: 'Ziggo Sport',
    parentId: slugify('VodafoneZiggo'),
    country: 'Netherlands',
    region: 'EMEA',
    entityType: 'Brand',
    serviceType: 'Sports TV',
    status: 'Current',
    notes: 'Media extension',
  },
  {
    id: slugify('Ziggo Sport Totaal'),
    name: 'Ziggo Sport Totaal',
    parentId: slugify('VodafoneZiggo'),
    country: 'Netherlands',
    region: 'EMEA',
    entityType: 'Brand',
    serviceType: 'Premium sports TV',
    status: 'Current',
    notes: 'Pay sports channels',
  },

  // CHILDREN OF telenet
  {
    id: slugify('BASE'),
    name: 'BASE',
    parentId: slugify('Telenet'),
    country: 'Belgium',
    region: 'EMEA',
    entityType: 'Brand',
    serviceType: 'Mobile network',
    status: 'Current',
    notes: 'Acquired mobile brand',
  },

  // CHILDREN OF virgin-media-ireland
  {
    id: slugify('Virgin Media Television'),
    name: 'Virgin Media Television',
    parentId: slugify('Virgin Media Ireland'),
    country: 'Ireland',
    region: 'EMEA',
    entityType: 'Brand',
    serviceType: 'Broadcast TV',
    status: 'Current',
    notes: 'Free-to-air channels',
  },

  // CHILDREN OF upc-broadband
  {
    id: slugify('UPC Slovakia'),
    name: 'UPC Slovakia',
    parentId: slugify('UPC Broadband'),
    country: 'Slovakia',
    region: 'EMEA',
    entityType: 'Regional operator',
    serviceType: 'Fixed broadband/TV',
    status: 'Sold',
    notes: 'Exited market (2025)',
  },
  {
    id: slugify('UPC Poland'),
    name: 'UPC Poland',
    parentId: slugify('UPC Broadband'),
    country: 'Poland',
    region: 'EMEA',
    entityType: 'Regional operator',
    serviceType: 'Fixed broadband/TV',
    status: 'Sold',
    notes: 'Sold to Iliad/Play',
  },
  {
    id: slugify('UPC Romania'),
    name: 'UPC Romania',
    parentId: slugify('UPC Broadband'),
    country: 'Romania',
    region: 'EMEA',
    entityType: 'Regional operator',
    serviceType: 'Fixed broadband/TV',
    status: 'Sold',
    notes: 'Integrated into Vodafone',
  },
  {
    id: slugify('UPC Hungary'),
    name: 'UPC Hungary',
    parentId: slugify('UPC Broadband'),
    country: 'Hungary',
    region: 'EMEA',
    entityType: 'Regional operator',
    serviceType: 'Fixed broadband/TV',
    status: 'Sold',
    notes: 'Integrated into Vodafone',
  },
  {
    id: slugify('UPC Czech Republic'),
    name: 'UPC Czech Republic',
    parentId: slugify('UPC Broadband'),
    country: 'Czech Republic',
    region: 'EMEA',
    entityType: 'Regional operator',
    serviceType: 'Fixed broadband/TV',
    status: 'Sold',
    notes: 'Integrated into Vodafone',
  },
  {
    id: slugify('UPC Sweden'),
    name: 'UPC Sweden',
    parentId: slugify('UPC Broadband'),
    country: 'Sweden',
    region: 'EMEA',
    entityType: 'Regional operator',
    serviceType: 'Fixed broadband/TV',
    status: 'Sold',
    notes: 'Exited',
  },
  {
    id: slugify('UPC France'),
    name: 'UPC France',
    parentId: slugify('UPC Broadband'),
    country: 'France',
    region: 'EMEA',
    entityType: 'Regional operator',
    serviceType: 'Fixed broadband/TV',
    status: 'Sold',
    notes: 'Exited',
  },
  {
    id: slugify('Chello'),
    name: 'Chello',
    parentId: slugify('UPC Broadband'),
    country: null,
    region: 'EMEA',
    entityType: 'Brand',
    serviceType: 'ISP broadband',
    status: 'Discontinued',
    notes: 'Early internet brand',
  },
];

export async function seedPartners(): Promise<void> {
  const db = getFirestore();
  const partnersRef = db.collection('partners');

  // Delete all existing partner documents
  const existingDocs = await partnersRef.get();
  if (!existingDocs.empty) {
    const deleteBatch = db.batch();
    for (const doc of existingDocs.docs) {
      deleteBatch.delete(doc.ref);
    }
    await deleteBatch.commit();
  }

  // Seed all partner documents
  console.log(`Seeding ${partners.length} partners...`);
  const batch = db.batch();
  for (const partner of partners) {
    const docRef = partnersRef.doc(partner.id);
    batch.set(docRef, partner);
  }
  await batch.commit();
  console.log('Partners seeded.');
}
