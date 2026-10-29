import {DurableObject} from 'cloudflare:workers';
import worker from './worker.js';
import {DedupStore} from './dedup.js';

export class UpdateDeduplicator extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.store = new DedupStore(ctx.storage.sql);
  }
  fetch(request) { return this.store.fetch(request); }
}

export default worker;
