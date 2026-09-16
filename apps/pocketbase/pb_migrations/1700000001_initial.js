migrate((app) => {
  const superuserEmail = $os.getenv("PB_SUPERUSER_EMAIL") || "admin@admin.com";
  const superuserPassword = $os.getenv("PB_SUPERUSER_PASSWORD") || "admin123456";

  try {
    app.findAuthRecordByEmail("_superusers", superuserEmail);
  } catch (e) {
    const superusers = app.findCollectionByNameOrId("_superusers");
    const superuser = new Record(superusers);
    superuser.set("email", superuserEmail);
    superuser.set("password", superuserPassword);
    superuser.set("passwordConfirm", superuserPassword);
    app.save(superuser);
  }

  let users;
  try {
    users = app.findCollectionByNameOrId("users");
  } catch (e) {
    users = new Collection({
      type: "auth",
      name: "users"
    });
  }

  users.listRule = "id = @request.auth.id";
  users.viewRule = "id = @request.auth.id";
  users.createRule = null;
  users.updateRule = "id = @request.auth.id";
  users.deleteRule = "id = @request.auth.id";
  users.authRule = "";

  users.fields.add(
    new TextField({
      name: "name",
      max: 80
    }),
    new TextField({
      name: "username",
      min: 3,
      max: 30,
      pattern: "^[a-z0-9._-]+$"
    }),
    new TextField({
      name: "phone",
      max: 30
    })
  );

  users.addIndex("idx_users_username_unique", true, "username", "username != ''");
  users.addIndex("idx_users_phone_unique", true, "phone", "phone != ''");
  users.passwordAuth.enabled = true;
  users.passwordAuth.identityFields = ["email", "username", "phone"];
  app.save(users);

  const tags = new Collection({
    type: "base",
    name: "tags",
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
        name: "name",
        required: true,
        max: 50
      },
      {
        type: "text",
        name: "color",
        required: true,
        max: 9
      },
      {
        type: "autodate",
        name: "created",
        onCreate: true
      },
      {
        type: "autodate",
        name: "updated",
        onCreate: true,
        onUpdate: true
      }
    ],
    indexes: [
      "CREATE INDEX idx_tags_user ON tags (user)"
    ]
  });
  app.save(tags);

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
        type: "bool",
        name: "all_day"
      },
      {
        type: "relation",
        name: "tag",
        maxSelect: 1,
        collectionId: tags.id,
        cascadeDelete: false
      },
      {
        type: "autodate",
        name: "created",
        onCreate: true
      },
      {
        type: "autodate",
        name: "updated",
        onCreate: true,
        onUpdate: true
      }
    ],
    indexes: [
      "CREATE INDEX idx_appointments_user_starts ON appointments (user, starts_at)"
    ]
  });
  app.save(appointments);

  const tasks = new Collection({
    type: "base",
    name: "tasks",
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
        name: "due_date",
        required: true
      },
      {
        type: "bool",
        name: "completed"
      },
      {
        type: "date",
        name: "completed_at"
      },
      {
        type: "relation",
        name: "tag",
        maxSelect: 1,
        collectionId: tags.id,
        cascadeDelete: false
      },
      {
        type: "autodate",
        name: "created",
        onCreate: true
      },
      {
        type: "autodate",
        name: "updated",
        onCreate: true,
        onUpdate: true
      }
    ],
    indexes: [
      "CREATE INDEX idx_tasks_user_due ON tasks (user, due_date)"
    ]
  });
  app.save(tasks);

  const phoneOtps = new Collection({
    type: "base",
    name: "phone_otps",
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      {
        type: "text",
        name: "phone",
        required: true,
        max: 30
      },
      {
        type: "text",
        name: "code",
        required: true,
        max: 10
      },
      {
        type: "text",
        name: "purpose",
        required: true,
        max: 20
      },
      {
        type: "date",
        name: "expires_at",
        required: true
      },
      {
        type: "bool",
        name: "used"
      },
      {
        type: "autodate",
        name: "created",
        onCreate: true
      },
      {
        type: "autodate",
        name: "updated",
        onCreate: true,
        onUpdate: true
      }
    ],
    indexes: [
      "CREATE INDEX idx_phone_otps_phone_code_purpose ON phone_otps (phone, code, purpose)"
    ]
  });
  app.save(phoneOtps);
}, (app) => {
  for (const name of ["phone_otps", "tasks", "appointments", "tags", "users"]) {
    try {
      app.delete(app.findCollectionByNameOrId(name));
    } catch (e) {}
  }

  const superuserEmail = $os.getenv("PB_SUPERUSER_EMAIL") || "admin@admin.com";
  try {
    app.delete(app.findAuthRecordByEmail("_superusers", superuserEmail));
  } catch (e) {}
});
