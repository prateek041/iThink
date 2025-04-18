# Product Introduction

It happens many times that I want to explore a rabbit hole, or run a thought
experiment to decide what is best out of any two options. In order to make an
informed decision I have to be informed first, and that is very tedious, and
prevents me from asking questions often.

Simple things like **"As an Indian, should I be worried about US Tariffs?"**,
or **"Is CS a good choice considering recent layoffs?"**, the possibilities
are just way too many, but I am limited by my knowledge and time.

**iThink** solves that problem. It is a debate platform, where two AI(s), with
all the knowledge in the world and access to recent events through internet
talk to each other on the topic of your choice. You can use this platform
in multiple ways, for example:

- As a platform to learn about something ("Is Quantum physics more revolutionary
  than Particle physics?").
- As a platform of entertainment, where two experts in domains talk to each other
  on the topic of your choice, just like massive platforms like [Intelligence Squared](https://youtube.com/@intelligence-squared?si=6CqpDzvnuOUfvHTX)

The platform relies on the `realtime API` from **OpenAI**, which gives the listener
an immersive and zero delay experience.

## Tech Stack

- Frontend:

  - Next JS.
  - Tailwind CSS.
  - ShadCN.
  - SocketIO (Client).

- Backend (proxy server):

  - Socket IO (Server).
  - Node JS.

- AI Layer:
  - Azure OpenAI SDK.
  - OpenAI realtime Endpoint.
  - OpenAI Whisper for transcription.

## How to run locally

This repository is a mono-repo, that contains the implementation of the Frontend
and the Backend code. To run it locally.

- Install dependencies:

  - Install overall dependencies to run the project concurrently.

    - `npm i`

  - Install Next-JS Frontend dependencies

    - `cd ithink-debate`
    - `npm i`

  - Install Node JS server proxy dependencies
    - `cd websocket-server`
    - `npm i`

- Setup `.env` files:

  - Both parts of the project have their `env.example` files present, fill them
    up with correct keys and save them.

- Run the project:
  - In the project root, run
    `npm run dev`
