migrate((app) => {
  // 1. Atualiza as regras de permissão da coleção 'batatas'
  try {
    const collection = app.findCollectionByNameOrId("batatas");
    collection.listRule = "";
    collection.viewRule = "";
    collection.createRule = "";
    collection.updateRule = "@request.auth.id != ''";
    collection.deleteRule = "@request.auth.id != ''";
    app.save(collection);
  } catch (e) {}

  // 2. Cria o usuário padrão de teste na coleção 'users'
  const email = "user@teste.com";
  const password = "senha123456";

  try {
    app.findAuthRecordByEmail("users", email);
  } catch (e) {
    const usersCollection = app.findCollectionByNameOrId("users");
    const record = new Record(usersCollection);
    record.set("email", email);
    record.set("password", password);
    record.set("passwordConfirm", password);
    record.set("emailVisibility", true);
    record.set("verified", true);
    app.save(record);
  }
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("batatas");
    collection.updateRule = "";
    collection.deleteRule = "";
    app.save(collection);
  } catch (e) {}

  try {
    const record = app.findAuthRecordByEmail("users", "user@teste.com");
    app.delete(record);
  } catch (e) {}
});
