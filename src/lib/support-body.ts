export async function readSupportBody(request: {body: ReadableStream<Uint8Array> | null}, maximum: number): Promise<ArrayBuffer> {
  if (!request.body) return new ArrayBuffer(0);
  const reader=request.body.getReader();const chunks:Uint8Array[]=[];let size=0;
  try {
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maximum){await reader.cancel();throw new Error("Body exceeds limit");}chunks.push(value);}
  } finally {reader.releaseLock();}
  const result=new Uint8Array(size);let offset=0;for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.byteLength;}return result.buffer;
}

