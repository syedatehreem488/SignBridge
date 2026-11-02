insert into public.signs (english, urdu, category, sign_type, model_label) values
  ('Hello', 'السلام علیکم', 'greeting', 'dynamic', 0),
  ('Thank you', 'شکریہ', 'greeting', 'dynamic', 1),
  ('Goodbye', 'خدا حافظ', 'greeting', 'dynamic', 2),
  ('Sorry', 'معاف کیجیے', 'greeting', 'dynamic', null),
  -- ... 30 more rows ...
on conflict (english) do update
  set urdu = excluded.urdu, category = excluded.category;