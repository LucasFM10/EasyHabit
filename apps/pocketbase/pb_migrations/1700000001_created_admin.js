migrate((app) => {
  const email = $os.getenv("PB_SUPERUSER_EMAIL") || "admin@admin.com";
  const password = $os.getenv("PB_SUPERUSER_PASSWORD") || "admin123456";

  try {
    app.findAuthRecordByEmail("_superusers", email);
  } catch (e) {
    const collection = app.findCollectionByNameOrId("_superusers");
    const record = new Record(collection);
    record.set("email", email);
    record.set("password", password);
    record.set("passwordConfirm", password);
    app.save(record);
  }
}, (app) => {
  const email = $os.getenv("PB_SUPERUSER_EMAIL") || "admin@admin.com";
  try {
    const record = app.findAuthRecordByEmail("_superusers", email);
    app.delete(record);
  } catch (e) {}
});
