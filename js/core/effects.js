// PR 1 contract harness. Production presentation keeps its existing event handlers.
// A handler returns true only after accepting delivery; adapter-specific voice receipts stay separate.
export async function drainEffects(store,handlers = {}) {
  let cancelled = false;
  const unsubscribe = store.onEvent(({type})=>{ if (type==='hilfer:progress-reset') cancelled=true; });
  try {
    // Subscribers run during publication. Claim only after its synchronous command queue settles.
    await Promise.resolve();
    for (const [occurrenceId,receipt] of Object.entries(store.getSnapshot().effectReceipts)) {
      if (cancelled) break;
      if (receipt.status !== 'pending') continue;
      const effect = store.getDefinitions().effects.find(e=>e.id===receipt.effectId);
      const handler = handlers[effect.adapter];
      if (typeof handler !== 'function') continue;
      const claim = store.dispatch({type:'ackEffect',occurrenceId,status:'claimed'});
      if (!claim.ok || !claim.changed || claim.code === 'QUEUED') continue;
      if (cancelled) break;
      let delivered = false;
      try { delivered = await handler(structuredClone(effect),{occurrenceId}) === true; }
      catch { /* Presentation failure never reverses accepted gameplay facts. */ }
      if (!cancelled) store.dispatch({type:'ackEffect',occurrenceId,status:delivered ? 'delivered' : 'skipped'});
    }
  } finally { unsubscribe(); }
}
