/** 串行保存队列（BUG-004）：每个任务在前一个结束后执行；idle() 只等待结束、不继承前一个任务的失败，
 * 避免一次 400 拒绝后 flush() 永远抛错。网络失败另由 Studio 的 failed 草稿与重试处理。 */
export function createSaveQueue(){
 let tail:Promise<unknown>=Promise.resolve();
 return {
  run<T>(job:()=>Promise<T>):Promise<T>{const next=tail.catch(()=>{}).then(job);tail=next;return next;},
  idle():Promise<void>{return tail.then(()=>{},()=>{});},
 };
}
