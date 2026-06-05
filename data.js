/* MGR Services catalog */
var MGR_PLATFORM_CHARGE = 99;
var MGR_PRICE_DISCLAIMER = "₹99 is our platform charge. After the vendor visits your home and sees your needs, the final price will be decided.";

var MGR_SERVICES = [
  { id: 1,  name: 'Home Deep Cleaning',      cat: 'Cleaning',     img: 'https://images.pexels.com/photos/4108715/pexels-photo-4108715.jpeg?auto=compress&cs=tinysrgb&w=600',  rating: 4.9, desc: 'Full home deep cleaning by professionals with eco-friendly products.' },
  { id: 2,  name: 'AC Service & Repair',     cat: 'Appliances',   img: 'https://images.pexels.com/photos/5463575/pexels-photo-5463575.jpeg?auto=compress&cs=tinysrgb&w=600',  rating: 4.9, desc: 'Complete AC servicing, gas refilling and repair.', badge: 'Popular' },
  { id: 3,  name: 'Refrigerator Repair',     cat: 'Appliances',   img: 'https://images.pexels.com/photos/9551373/pexels-photo-9551373.jpeg?auto=compress&cs=tinysrgb&w=600',  rating: 4.8, desc: 'Expert fridge repair for all brands — cooling, compressor, gas.' },
  { id: 4,  name: 'Washing Machine Repair',  cat: 'Appliances',   img: 'https://images.pexels.com/photos/5591581/pexels-photo-5591581.jpeg?auto=compress&cs=tinysrgb&w=600',  rating: 4.7, desc: 'Front load and top load washing machine repair.' },
  { id: 5,  name: 'Microwave Repair',        cat: 'Appliances',   img: 'https://images.pexels.com/photos/32168944/pexels-photo-32168944.jpeg?auto=compress&cs=tinysrgb&w=600', rating: 4.6, desc: 'Microwave oven repair and servicing for all brands.' },
  { id: 6,  name: 'TV & Electronics Repair', cat: 'Appliances',   img: 'https://images.pexels.com/photos/1432669/pexels-photo-1432669.jpeg?auto=compress&cs=tinysrgb&w=600',  rating: 4.7, desc: 'LED, LCD and Smart TV repair at your doorstep.' },
  { id: 7,  name: 'Plumbing Repair',         cat: 'Plumbing',     img: 'https://images.pexels.com/photos/6419128/pexels-photo-6419128.jpeg?auto=compress&cs=tinysrgb&w=600',  rating: 4.9, desc: 'Leak fixing, pipe repair and installation.' },
  { id: 8,  name: 'Tap & Faucet Repair',     cat: 'Plumbing',     img: 'https://images.pexels.com/photos/4153144/pexels-photo-4153144.jpeg?auto=compress&cs=tinysrgb&w=600',  rating: 4.8, desc: 'Tap replacement, faucet repair and fitting.' },
  { id: 9,  name: 'Bathroom Fitting',        cat: 'Plumbing',     img: 'https://images.pexels.com/photos/8134822/pexels-photo-8134822.jpeg?auto=compress&cs=tinysrgb&w=600',  rating: 4.8, desc: 'Complete bathroom fitting — showers, geysers, sanitary ware.' },
  { id: 10, name: 'Drain Unclogging',        cat: 'Plumbing',     img: 'https://images.pexels.com/photos/4239115/pexels-photo-4239115.jpeg?auto=compress&cs=tinysrgb&w=600',  rating: 4.7, desc: 'Drain and pipeline blockage removal using professional tools.' },
  { id: 11, name: 'Electrical Repair',       cat: 'Electrical',   img: 'https://images.pexels.com/photos/27928762/pexels-photo-27928762.jpeg?auto=compress&cs=tinysrgb&w=600', rating: 4.9, desc: 'Safe wiring, MCB and electrical repair by certified electricians.' },
  { id: 12, name: 'Fan Installation',        cat: 'Electrical',   img: 'https://images.pexels.com/photos/7027844/pexels-photo-7027844.jpeg?auto=compress&cs=tinysrgb&w=600',  rating: 4.8, desc: 'Ceiling and exhaust fan installation and replacement.' },
  { id: 13, name: 'Switch & Socket Repair',  cat: 'Electrical',   img: 'https://images.pexels.com/photos/5691602/pexels-photo-5691602.jpeg?auto=compress&cs=tinysrgb&w=600',  rating: 4.7, desc: 'Switchboard and socket repair, replacement and new wiring.' },
  { id: 14, name: 'Light Installation',      cat: 'Electrical',   img: 'https://images.pexels.com/photos/7641361/pexels-photo-7641361.jpeg?auto=compress&cs=tinysrgb&w=600',  rating: 4.8, desc: 'LED, smart and decorative light installation.' },
  { id: 15, name: 'Facial & Skincare',       cat: 'Beauty',       img: 'https://images.pexels.com/photos/3997993/pexels-photo-3997993.jpeg?auto=compress&cs=tinysrgb&w=600',  rating: 4.9, desc: 'Professional facial, de-tan and cleanup at home.' },
  { id: 16, name: 'Haircut & Styling',       cat: 'Beauty',       img: 'https://images.pexels.com/photos/3993449/pexels-photo-3993449.jpeg?auto=compress&cs=tinysrgb&w=600',  rating: 4.8, desc: 'Expert haircut and styling for men and women at doorstep.' },
  { id: 17, name: 'Bridal Makeup',           cat: 'Beauty',       img: 'https://images.pexels.com/photos/16799888/pexels-photo-16799888.jpeg?auto=compress&cs=tinysrgb&w=600', rating: 4.9, desc: 'Complete bridal makeup, mehendi and pre-bridal grooming.' },
  { id: 18, name: 'Waxing & Threading',      cat: 'Beauty',       img: 'https://images.pexels.com/photos/6135620/pexels-photo-6135620.jpeg?auto=compress&cs=tinysrgb&w=600',  rating: 4.7, desc: 'Full body waxing, eyebrow threading and shaping.' },
  { id: 19, name: 'Manicure & Pedicure',     cat: 'Beauty',       img: 'https://images.pexels.com/photos/34930117/pexels-photo-34930117.jpeg?auto=compress&cs=tinysrgb&w=600', rating: 4.8, desc: 'Spa-quality nail care, scrub and foot massage at home.' },
  { id: 20, name: 'Massage & Spa',           cat: 'Beauty',       img: 'https://images.pexels.com/photos/18120173/pexels-photo-18120173.jpeg?auto=compress&cs=tinysrgb&w=600', rating: 4.9, desc: 'Relaxing full body massage by certified therapists at home.' },
  { id: 21, name: 'Interior Painting',       cat: 'Painting',     img: 'https://images.pexels.com/photos/1669754/pexels-photo-1669754.jpeg?auto=compress&cs=tinysrgb&w=600',  rating: 4.8, desc: 'Professional interior wall painting with premium paints.' },
  { id: 22, name: 'Exterior Painting',       cat: 'Painting',     img: 'https://images.pexels.com/photos/209315/pexels-photo-209315.jpeg?auto=compress&cs=tinysrgb&w=600',    rating: 4.7, desc: 'Durable exterior wall and terrace waterproofing painting.' },
  { id: 23, name: 'Wood Polishing',          cat: 'Painting',     img: 'https://images.pexels.com/photos/1957477/pexels-photo-1957477.jpeg?auto=compress&cs=tinysrgb&w=600',  rating: 4.8, desc: 'Furniture and floor wood polishing and varnishing.' },
  { id: 24, name: 'Pest Control',            cat: 'Pest Control', img: 'https://images.pexels.com/photos/4099263/pexels-photo-4099263.jpeg?auto=compress&cs=tinysrgb&w=600',  rating: 4.9, desc: 'Complete home pest control for cockroaches, ants and rodents.' },
  { id: 25, name: 'Termite Treatment',       cat: 'Pest Control', img: 'https://images.pexels.com/photos/5029088/pexels-photo-5029088.jpeg?auto=compress&cs=tinysrgb&w=600',  rating: 4.8, desc: 'Pre and post construction anti-termite treatment.' },
  { id: 26, name: 'Furniture Assembly',      cat: 'Carpentry',    img: 'https://images.pexels.com/photos/5805494/pexels-photo-5805494.jpeg?auto=compress&cs=tinysrgb&w=600',  rating: 4.8, desc: 'Expert assembly of modular and flat-pack furniture.' },
  { id: 27, name: 'Home Shifting',           cat: 'Shifting',     img: 'https://images.pexels.com/photos/4246120/pexels-photo-4246120.jpeg?auto=compress&cs=tinysrgb&w=600',  rating: 4.8, desc: 'Complete home shifting with packing, loading and moving.' }
];

var MGR_CATEGORIES = ['All'].concat(MGR_SERVICES.reduce(function(acc, s) {
  if (acc.indexOf(s.cat) === -1) acc.push(s.cat);
  return acc;
}, []));

var MGR_CAT_ICON = {
  'All': '🏠', 'Cleaning': '🧹', 'Appliances': '🧊', 'Plumbing': '🚿',
  'Electrical': '💡', 'Beauty': '💆', 'Painting': '🎨',
  'Pest Control': '🐜', 'Carpentry': '🔨', 'Shifting': '📦'
};
