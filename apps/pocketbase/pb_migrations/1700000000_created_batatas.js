migrate((app) => {
  try {
    app.findCollectionByNameOrId("batatas");
  } catch (e) {
    const collection = new Collection({
      name: "batatas",
      type: "base",
      listRule: "",
      viewRule: "",
      createRule: "",
      updateRule: "",
      deleteRule: ""
    });

    collection.fields.add(new TextField({
      name: "name",
      required: true
    }));

    collection.fields.add(new TextField({
      name: "tipo"
    }));

    app.save(collection);
  }
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("batatas");
    app.delete(collection);
  } catch (e) {}
});
