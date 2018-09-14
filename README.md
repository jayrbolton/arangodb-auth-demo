# ArangoDB demo -- Users, Workspaces, and Objects

This is a trial demo of ArangoDB that sets up a database with users, workspaces, and objects,
similar to the system found in KBase.

This is all centered around one Foxx microservice app which can be found in the `/api` directory

## Features

- User auth (signup/login/logout/whoami), password hashing and validation
- Workspace creation, listing, sharing, and copying
- Object creation, updating (which does a copy), and listing

## DB schema

_Collections_
- users
- workspaces
- objects
- sessions

_Edges_
- contains (workspaces `contains` objects)
- hasPerm (users `hasPerm` workspaces (with name "canEdit" or "canView"))

_Auth rules - workspaces_
- When a user creates a workspace, they have the "canEdit" permission on it
- A user can add another user as an editor or viewer to a workspace
- A user can copy a workspace if they can view it
  - When a user copies a workspace, it is made private and they are the only editor
- A user can make a workspace public, which makes everyone a viewer
- A user can only view workspaces that are public, viewable, or editable

_Auth rules - objects_
- A user can only create an object in a workspace in which they are an editor
- A user can only view objects for a workspace in which they are a viewer (or editor)
- A user can update an object in a workspace if they are an editor of the workspace

_More copying details_
- When a user copies a workspace, new `contains` edges are created between all objects in the old
  workspace and the new workspace (the objects are not copied; only new references are made)
- If a user updates an object in a copied workspace, a new object is created with a single
  `contains` edge that links the workspace in which they made the edit and the new object
  (therefore, editors/viewers of the old workspace have no access to the updated object)

## API

View the API via the Swagger UI documention, which can be found at:

- View the endpoint "/_db/_system/basic/docs"
- View the "basic" API service under "services" in the dashboard

## Running

You can run ArangoDB locally using the provided simple docker-compose.yaml:

```sh
$ docker-compose up
```

Then open up `localhost:8529` with user root and pass `password`. Use the database "_system".

## Updating

I like to use the foxx cli to do updates and run tests:

```sh
# Update the service immediately:
$ foxx upgrade --dev /basic --server http://localhost:8529 -u root -p pass -v 
$ foxx test /basic -u root -p pass
```

You can also zip the api folder and upload via the dashboard

## Resources

* [Foxx Fine-Grained Permissions Tutorial](https://www.arangodb.com/foxx-fine-grained-permissions/)
* [Using authentication (Cookbook)](https://docs.arangodb.com/3.3/Cookbook/Administration/Authentication.html)
* [Authentication (Manual - Getting Started)](https://docs.arangodb.com/3.3/Manual/GettingStarted/Authentication.html)
* [User Management (Foxx Manual)](https://docs.arangodb.com/3.3/Manual/Foxx/Users.html)

# License

Copyright (c) 2018 kbase

License: MIT
