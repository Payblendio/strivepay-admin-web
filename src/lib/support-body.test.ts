import {expect,it,vi} from "vitest";
import {readSupportBody} from "./support-body";
it("joins bounded binary chunks without changing the bytes",async()=>{
 const stream=new ReadableStream<Uint8Array>({start(controller){controller.enqueue(new Uint8Array([0,255]));controller.enqueue(new Uint8Array([1,2]));controller.close();}});
 expect([...new Uint8Array(await readSupportBody({body:stream},4))]).toEqual([0,255,1,2]);
});
it("cancels an oversized body before buffering further data",async()=>{
 const cancel=vi.fn();
 const stream=new ReadableStream<Uint8Array>({start(controller){controller.enqueue(new Uint8Array(5));},cancel});
 await expect(readSupportBody({body:stream},4)).rejects.toThrow("limit");
 expect(cancel).toHaveBeenCalledOnce();
});

