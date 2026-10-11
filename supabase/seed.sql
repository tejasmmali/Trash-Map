-- Demo data: 25 clearly marked sample reports across Mumbai (is_sample = true).
-- Re-runnable: removes previous sample rows first. Never touches real reports.

delete from public.reports where is_sample;

insert into public.reports (image_url, latitude, longitude, category, description, status, created_at, resolved_at, is_sample)
select
  '/samples/sample-report.svg',
  lat,
  lng,
  category::public.report_category,
  '[SAMPLE] ' || description,
  status::public.report_status,
  now() - make_interval(days => age_days),
  case when status = 'resolved' then now() - make_interval(days => greatest(age_days - 2, 0)) end,
  true
from (values
  (19.0178, 72.8478, 'mixed',        'Overflowing bins outside Dadar station',        'pending',      12),
  (19.0490, 72.8260, 'plastic',      'Plastic bottles along Bandra Reclamation',      'pending',       3),
  (19.1197, 72.8826, 'construction', 'Debris dumped on a footpath in Marol',          'in_progress',   9),
  (19.0726, 72.8793, 'organic',      'Market waste piled near Kurla West',            'pending',      20),
  (19.0380, 72.8538, 'mixed',        'Garbage heap beside a Dharavi lane',            'pending',      30),
  (18.9067, 72.8147, 'plastic',      'Wrappers and cups on Colaba Causeway',          'resolved',      6),
  (18.9474, 72.8343, 'organic',      'Vegetable waste behind Crawford Market',        'pending',       5),
  (19.0176, 72.8162, 'plastic',      'Plastic washed up at Worli Koliwada',           'pending',      15),
  (19.0988, 72.8267, 'plastic',      'Litter along Juhu Beach after the weekend',     'resolved',      4),
  (19.1310, 72.8150, 'mixed',        'Waste near Versova fish market',                'in_progress',  11),
  (19.1663, 72.8526, 'construction', 'Rubble on a Goregaon West side road',           'pending',       7),
  (19.1870, 72.8240, 'mixed',        'Open dumping near Malvani',                     'pending',      25),
  (19.2290, 72.8570, 'plastic',      'Bags piled at Borivali station exit',           'pending',       2),
  (19.2050, 72.8700, 'organic',      'Food waste outside eateries in Kandivali East', 'resolved',     10),
  (19.0860, 72.9080, 'mixed',        'Uncollected garbage in Ghatkopar West',         'pending',      14),
  (19.1110, 72.9280, 'construction', 'Tiles and cement bags near Vikhroli',           'pending',       8),
  (19.1726, 72.9425, 'other',        'Discarded furniture in Mulund West',            'in_progress',   6),
  (19.0622, 72.8990, 'organic',      'Garden waste on a Chembur street corner',       'pending',       1),
  (19.0550, 72.9200, 'mixed',        'Waste spillover near Deonar',                   'pending',      28),
  (19.0390, 72.8619, 'plastic',      'Plastic under the Sion flyover',                'pending',      13),
  (19.0270, 72.8550, 'organic',      'Flower waste near Matunga market',              'resolved',      3),
  (19.0410, 72.8400, 'mixed',        'Garbage along Mahim Causeway',                  'pending',      18),
  (19.1260, 72.9050, 'plastic',      'Bottles on the Powai lake promenade',           'pending',       4),
  (19.0810, 72.8550, 'construction', 'Renovation debris in Santacruz East',           'in_progress',  16),
  (18.9790, 72.8330, 'other',        'E-waste and old mattresses in Byculla',         'pending',      22)
) as sample(lat, lng, category, description, status, age_days);
