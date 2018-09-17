# ArangoDB demo -- Users, Workspaces, and Objects

This is a trial demo of ArangoDB that sets up a database with users, workspaces, and objects,
similar to the system found in KBase for the purpose of testing out Arango features.

This is all centered around one Foxx microservice app which can be found in the `/api` directory

## Features

- User auth (signup/login/logout/whoami), password hashing and validation
- Workspace creation, listing, sharing, and copying
- Object creation, updating (which does a copy), and listing
- Object -> object connections using a kind of provenance (`updatedTo` edge)
- User -> workspace -> object permissions

## DB schema

_Collections_
- users
- workspaces
- objects
- sessions

_Edges_
- contains (workspaces `contains` objects)
- hasPerm (users `hasPerm` workspaces (with name "canEdit" or "canView"))
- updatedTo (objectA `updatedTo` objectB where objectA.version = objectB.version-1)

_Auth rules - workspaces_
- When a user creates a workspace, they have the "canEdit" permission on it
- A user can add another user as an editor or viewer to a workspace
- A user can copy a workspace if they can view it
  - When a user copies a workspace, it is made private and they are the only editor
  - All objects in the previous workspace are accessible in the copied workspace
  - All objects are immutable, so any changes to objects in the copied workspace creates a new
    object that is private to the copied workspace
- A user can make a workspace public, which makes everyone a viewer
- A user can only view workspaces that are public, viewable, or editable

_Auth rules - objects_
- A user can only create an object in a workspace in which they are an editor
- A user can only view objects for a workspace in which they are a viewer (or editor)
- A user can view objects through the "provenance" chain (using the `updatedTo` edge), even if
  those objects are in other, private workspaces.
- A user can update an object in a workspace if they are an editor of the workspace

_More copying details_
- When a user copies a workspace, new `contains` edges are created between all objects in the old
  workspace and the new workspace (the objects are not copied; only new references are made)
- If a user updates an object in a copied workspace, a new object is created that is only linked to
  the new, copied worksapce. (Viewers of the old workspace have no access to the updated object.
  Only users who can view the copied workspace can view the updated object.)

## API

View the API via the Swagger UI documention, which can be found at:

- View the endpoint "/_db/_system/basic/docs"
- View the "basic" API service under "services" in the dashboard

## Running

You can run and test ArangoDB locally using the provided simple docker-compose.yaml:

```sh
$ docker-compose up
```

Then open up `localhost:8529` with user root and pass `password`. Use the database "_system".

The database schema should get loaded when you run the stup for the `basic` service

## Updating

I like to use the foxx cli to do updates and run tests:

```sh
# Update the service immediately:
$ foxx upgrade --dev /basic --server http://localhost:8529 -u root -p pass -v 
$ foxx test /basic -u root -p pass
```

You can also zip the api folder and upload manually via the dashboard

## Resources

* [Foxx Fine-Grained Permissions Tutorial](https://www.arangodb.com/foxx-fine-grained-permissions/)
* [Using authentication (Cookbook)](https://docs.arangodb.com/3.3/Cookbook/Administration/Authentication.html)
* [Authentication (Manual - Getting Started)](https://docs.arangodb.com/3.3/Manual/GettingStarted/Authentication.html)
* [User Management (Foxx Manual)](https://docs.arangodb.com/3.3/Manual/Foxx/Users.html)

# License

Copyright (c) 2018 kbase

License: MIT
