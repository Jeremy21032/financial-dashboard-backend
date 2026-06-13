-- Vistas agregadas para el resumen de graduación

CREATE OR REPLACE VIEW graduation_course_totals AS
SELECT
  gcc.campaign_id,
  gcc.course_id,
  gcc.expected_contribution,
  COALESCE(SUM(gc.amount), 0) AS total_contributed
FROM graduation_campaign_courses gcc
LEFT JOIN graduation_contributions gc
  ON gc.campaign_id = gcc.campaign_id AND gc.course_id = gcc.course_id
GROUP BY gcc.campaign_id, gcc.course_id, gcc.expected_contribution;

CREATE OR REPLACE VIEW graduation_activity_totals AS
SELECT
  ga.id AS activity_id,
  ga.campaign_id,
  ga.name,
  ga.planned_budget,
  ga.sort_order,
  COALESCE(SUM(ge.amount), 0) AS total_spent
FROM graduation_activities ga
LEFT JOIN graduation_expenses ge ON ge.activity_id = ga.id
GROUP BY ga.id, ga.campaign_id, ga.name, ga.planned_budget, ga.sort_order;
