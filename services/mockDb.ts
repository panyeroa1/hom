import { ApartmentSearchFilters, Listing } from '../types';

const MOCK_LISTINGS: Listing[] = [
  {
    id: '1',
    name: 'Modern Loft in City Center',
    address: 'Grote Markt 12, Ieper',
    price: 850,
    imageUrls: ['https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80'],
    energyClass: 'A',
    type: 'apartment',
    size: 85,
    description: 'Beautiful loft with high ceilings and view of the market square.',
    bedrooms: 1,
    petsAllowed: false
  },
  {
    id: '2',
    name: 'Spacious Family House',
    address: 'Rijselstraat 45, Ieper',
    price: 1200,
    imageUrls: ['https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=800&q=80'],
    energyClass: 'B',
    type: 'house',
    size: 150,
    description: 'Renovated family home with a small garden.',
    bedrooms: 3,
    petsAllowed: true
  },
  {
    id: '3',
    name: 'Cozy Studio near Station',
    address: 'Stationsstraat 8, Ieper',
    price: 550,
    imageUrls: ['https://images.unsplash.com/photo-1554995207-c18c203602cb?auto=format&fit=crop&w=800&q=80'],
    energyClass: 'C',
    type: 'studio',
    size: 40,
    description: 'Perfect for students or singles. Close to public transport.',
    bedrooms: 0,
    petsAllowed: false
  },
  {
    id: '4',
    name: 'Luxury Apartment with Terrace',
    address: 'Boterstraat 36, Ieper',
    price: 950,
    imageUrls: ['https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80'],
    energyClass: 'A+',
    type: 'apartment',
    size: 95,
    description: 'Modern finishing, large terrace, underground parking included.',
    bedrooms: 2,
    petsAllowed: true
  },
  {
    id: '5',
    name: 'Historic Townhouse',
    address: 'Menenstraat 20, Ieper',
    price: 1100,
    imageUrls: ['https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=800&q=80'],
    energyClass: 'D',
    type: 'house',
    size: 130,
    description: 'Charming authentic house. Needs some love but full of character.',
    bedrooms: 3,
    petsAllowed: true
  },
  {
    id: '6',
    name: 'Budget 2-Bedroom',
    address: 'Diksmuidseweg 100, Ieper',
    price: 700,
    imageUrls: ['https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=800&q=80'],
    energyClass: 'C',
    type: 'apartment',
    size: 75,
    description: 'Affordable apartment just outside the center. Features a cozy living area and basic amenities.',
    bedrooms: 2,
    petsAllowed: true
  }
];

export async function searchListings(filters: ApartmentSearchFilters): Promise<Listing[]> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500));

  let results = [...MOCK_LISTINGS];

  if (filters.city) {
    const city = filters.city.toLowerCase();
    results = results.filter(l => l.address.toLowerCase().includes(city));
  }

  // Naive neighborhood check (just checks address string)
  if (filters.neighborhood) {
    const hood = filters.neighborhood.toLowerCase();
    results = results.filter(l => l.address.toLowerCase().includes(hood));
  }

  if (filters.minPrice != null) {
    results = results.filter(l => l.price >= filters.minPrice!);
  }

  if (filters.maxPrice != null) {
    results = results.filter(l => l.price <= filters.maxPrice!);
  }

  if (filters.minSize != null) {
    results = results.filter(l => l.size >= filters.minSize!);
  }

  if (filters.maxSize != null) {
    results = results.filter(l => l.size <= filters.maxSize!);
  }

  if (filters.type) {
    const type = filters.type.toLowerCase();
    results = results.filter(l => l.type.toLowerCase() === type);
  }
  
  if (filters.bedrooms != null) {
     results = results.filter(l => l.bedrooms >= filters.bedrooms!);
  }

  if (filters.petsAllowed === true) {
    results = results.filter(l => l.petsAllowed === true);
  }

  // Sorting
  if (filters.sortBy === 'price_asc') {
    results.sort((a, b) => a.price - b.price);
  } else if (filters.sortBy === 'price_desc') {
    results.sort((a, b) => b.price - a.price);
  } else if (filters.sortBy === 'size') {
    results.sort((a, b) => b.size - a.size);
  }

  return results;
}