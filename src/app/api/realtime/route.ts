import { client } from "@/lib/azure/client";
import { OpenAIRealtimeWS } from "openai/src/beta/realtime/ws.js";

export async function GET(req: Request) {
  const rt = await OpenAIRealtimeWS.azure(client)

  rt.socket.on('open', () => {
    console.log('Connection opened!');

    rt.send({
      type: 'session.update',
      session: {
        modalities: ['text'],
        model: 'gpt-4o-realtime-preview',
      },
    });

    rt.send({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: 'Say a couple paragraphs!' }],
      },
    });

    // Signal that we're ready to receive a response from the model
    rt.send({ type: 'response.create' });
  });


  rt.on('session.created', (event) => {
    console.log('session created!', event.session);
    console.log();
  });

  rt.on('response.text.delta', (event) => process.stdout.write(event.delta));
  rt.on('response.text.done', () => console.log());

  rt.on('response.done', () => rt.close());

  rt.socket.on('close', () => console.log('\nConnection closed!'));

  rt.on('error', (err) => {
    // Log the error or handle it based on your application needs
    console.error('An error occurred:', err);
  });
}
