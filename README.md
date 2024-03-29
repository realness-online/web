# Realness: A Chill Vector Space

![Realness](public/icons.svg)

Realness is for churches, punks, and veterans: any organization whose core tenants are at odds with advertising-based social networking.

Realness web is the source code for [realness.online](https://realness.online). This code is a tool for you to build and moderate your own social networks.

Learn more about the [philosophy](docs/philosophy.md), [architecture](docs/architecture.md), how to [contribute](docs/contributing.md), or dive in and setup a Realness of your own.

## Install

### Clone and install

From your favorite terminal

```bash
git clone git@github.com:realness-online/web.git

cd web

yarn install
```

### Configure firebase

Add a project from the [firebase console](https://console.firebase.google.com). Bear in mind that the name you give your project will be it's url for your social network

`https://${project-name}.web.app`

Once your project is created you will want to enable phone authentication and file storage.

#### Enable phone authentication

- Click getting started from the authentication screen

- Edit the configuration for phone

- Enable and save

#### Enable Storage

- Click to get started from storage tab

- Accept the default security rules (they will be configured with deploy)

- Pick your region

### Deploy to firebase

Install firebase-tools, login, and deploy

```bash
yarn global add firebase-tools

firebase login

yarn deploy
```

# DONE!

Visit [https://${project-name}.web.app](https://${name}.wep.app). You can sign in and invite your friends

## Contributing

Moderators are ideal contributors. Setting up an instance of realness is also setting yourself up to help. Please read our [guidelines](docs/contributing.md)

## Support

We invite you to [Join realness online](https://realness.online) if you are interested in contributing or getting some friendly technical support for Moderating

## License

One instance of realness per human person. This human person is the moderator.

A moderator takes responsibility for the content that is created within their instance of Realness.

By moderating an instance of Realness you become part of a chain of responsibility that is diffuse. Each instance of Realness is a unique opportunity for users to negotiate norms with their moderator. This way, human beings can move between networks naturally; choosing a Realness that is a good fit for them.

It is the explicit goal of realness to create a democratic environment where people feel free to share and communicate yet it is clear whose ass is on the line for what gets said, organized, and done.

Currently [package.json](package.json) has the license field marked as UNLICENSED – This is because we are in an alpha phase of the product roadmap. We need to figure this license out.
