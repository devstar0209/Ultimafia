# Setting up Bot Games

## Add `dev` property to your user

1. Enter the mongo shell via `mongosh`.

```
docker exec -it mongo mongosh
```

2. Authenticate as admin.

```
test> use admin
switched to db admin

admin> db.auth('admin', passwordPrompt())
Enter password
********{ ok: 1 }

admin>
```

3. Enter the PassionMafia db (`$MONGO_DB`).

```
admin> use PassionMafia
switched to db PassionMafia
```

5. Add the dev property to your user.

```
PassionMafia> db.users.updateOne(
    { name: '<username>' },
    { $set: {dev: 'true'} })

{
  acknowledged: true,
  modifiedCount: 1
}
```

6. Check that your user has the dev property.

```
PassionMafia> db.users.find({}, {name:1, dev:1})
[
  {
    _id: ObjectId('XXX'),
    name: '<username>',
    dev: 'true'
  }
]
```

#### (Optional) Set as Owner

Owner permissions are not needed for testing roles but it will come in handy to test other site functions like forum and chat.

1. Get your user ObjectId.

```
PassionMafia> db.users.find({}, {name:1})
```

2. Get the group ObjectId.

```
PassionMafia> db.groups.find({name:'Owner'}, {name:1})
```

3. Add the group mapping.

```
PassionMafia> db.ingroups.insertOne(
  {
    user: ObjectId("6XXXuserId"),
    group: ObjectId("6YYYgroupId")
  })
```

## Testing games with bots

1. Create and host a setup.

2. A test tube icon appears in the top bar.

<img src="https://github.com/PassionMafia/PassionMafia/assets/24848927/a036535a-d107-4ecb-8c06-0a49629972fd" alt="test tube" width="300"/>

3. Click the test tube icon and bot accounts will spawn in new windows.
