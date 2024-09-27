const historyTransformPromises = rawHistory.map(async (rawTx) => {
  const caller = addressUtils.getAddressFromPubkey(rawTx.nc_pubkey, network).base58;
  const actions = rawTx.nc_context.actions.map((each) => ({
    type: each.type, // 'deposit' or 'withdrawal'
    uid: each.token_uid,
    amount: each.amount,
  }));

  const isMine = await utils.isAddressMine(wallet, caller, useWalletService);

  const tx = {
    txId: rawTx.hash,
    timestamp: rawTx.timestamp,
    tokens: rawTx.tokens,
    isVoided: rawTx.is_voided,
    ncId: rawTx.nc_id,
    ncMethod: rawTx.nc_method,
    blueprintId: rawTx.nc_blueprint_id,
    firstBlock: rawTx.first_block,
    caller,
    actions,
    isMine,
  };
  return tx;
});

const historyNewestToOldest = await Promise.all(historyTransformPromises);
