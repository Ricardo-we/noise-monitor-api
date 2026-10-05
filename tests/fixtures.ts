export const validReading = {
  timestamp: "2026-10-05T18:00:00.000Z",
  latitude: 14.6349,
  longitude: -90.5069,
  student_id: "test-student",
  auth_hash: "a".repeat(64),
  domain_data: {
    metric: "avg" as const,
    value_db: 62.4,
    noise_min_db: 48.1,
    noise_max_db: 78.9,
    noise_avg_db: 62.4,
    recording_duration_ms: 3000,
    device_model: "Test device",
    app_version: "1.0.0",
  },
};
