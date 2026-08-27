migrate((app) => {
  // Reinicia o modelo da aplicação, preservando apenas coleções internas.
  const appCollections = app.findAllCollections("base", "view");
  for (const collection of appCollections) {
    if (!collection.name.startsWith("_")) {
      app.delete(collection);
    }
  }

  const users = app.findCollectionByNameOrId("users");

  // Este reset roda uma única vez e deixa somente o superusuário configurado.
  const existingUsers = app.findAllRecords(users);
  for (const record of existingUsers) {
    app.delete(record);
  }
  users.listRule = "id = @request.auth.id";
  users.viewRule = "id = @request.auth.id";
  users.createRule = "@request.body.inviteCode = 'uNqcJ3wJMvco6avezBERug'";
  users.updateRule = "id = @request.auth.id";
  users.deleteRule = "id = @request.auth.id";

  try {
    users.fields.getByName("name");
  } catch (e) {
    users.fields.add(new TextField({
      name: "name",
      max: 80
    }));
  }

  app.save(users);

  try {
    app.findCollectionByNameOrId("appointments");
  } catch (e) {
    const appointments = new Collection({
      type: "base",
      name: "appointments",
      listRule: "user = @request.auth.id",
      viewRule: "user = @request.auth.id",
      createRule: "@request.auth.id != '' && @request.body.user = @request.auth.id",
      updateRule: "user = @request.auth.id && @request.body.user:changed = false",
      deleteRule: "user = @request.auth.id",
      fields: [
        {
          type: "relation",
          name: "user",
          required: true,
          maxSelect: 1,
          collectionId: users.id,
          cascadeDelete: true
        },
        {
          type: "text",
          name: "title",
          required: true,
          max: 140
        },
        {
          type: "text",
          name: "description",
          max: 2000
        },
        {
          type: "date",
          name: "starts_at",
          required: true
        },
        {
          type: "date",
          name: "ends_at",
          required: true
        },
        {
          type: "select",
          name: "color",
          maxSelect: 1,
          values: ["violet", "blue", "green", "amber", "rose"]
        }
      ],
      indexes: [
        "CREATE INDEX idx_appointments_user_starts ON appointments (user, starts_at)"
      ]
    });

    app.save(appointments);
  }
}, (app) => {
  try {
    app.delete(app.findCollectionByNameOrId("appointments"));
  } catch (e) {}
});
