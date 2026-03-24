-- Foresight – add circle-relative normalized coordinate columns to data_points
-- These store the shot position as a fraction of missRadiusPx, relative to the
-- circle center (negative = left / up), making stats screen-size-independent.
-- Legacy rows will have NULL for these columns; Record.tsx falls back to
-- computing them from the stored absolute (shot_x, shot_y) coordinates.
ALTER TABLE data_points
  ADD COLUMN IF NOT EXISTS rel_x FLOAT,
  ADD COLUMN IF NOT EXISTS rel_y FLOAT;
