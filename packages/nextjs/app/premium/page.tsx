"use client";

import { useState } from "react";
import type { NextPage } from "next";
import { createThirdwebClient, defineChain } from "thirdweb";
import { viemAdapter } from "thirdweb/adapters/viem";
import { createWalletAdapter } from "thirdweb/wallets";
import { wrapFetchWithPayment } from "thirdweb/x402";
import { erc20Abi, parseUnits } from "viem";
import { useAccount, useReadContracts, useSwitchChain, useWalletClient } from "wagmi";
import { X402_CHAIN, X402_PRICE, X402_TOKEN_ADDRESS } from "~~/services/x402/config";
import { getParsedError, notification } from "~~/utils/scaffold-eth";

const THIRDWEB_CLIENT_ID = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID;
// thirdweb pins its own viem version, so wagmi's WalletClient type doesn't match its parameter type exactly.
type ThirdwebViemWalletClient = Parameters<typeof viemAdapter.walletClient.fromViem>[0]["walletClient"];

const Premium: NextPage = () => {
  const { chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { data: walletClient } = useWalletClient({ chainId: X402_CHAIN.id });
  const { data: token } = useReadContracts({
    allowFailure: false,
    contracts: [
      { address: X402_TOKEN_ADDRESS, abi: erc20Abi, functionName: "symbol", chainId: X402_CHAIN.id },
      { address: X402_TOKEN_ADDRESS, abi: erc20Abi, functionName: "decimals", chainId: X402_CHAIN.id },
    ],
    query: { enabled: !!X402_TOKEN_ADDRESS },
  });
  const [data, setData] = useState<unknown>();
  const [isPaying, setIsPaying] = useState(false);

  if (!X402_TOKEN_ADDRESS || !THIRDWEB_CLIENT_ID) {
    return (
      <div className="alert alert-warning m-10 w-auto">
        Set NEXT_PUBLIC_X402_TOKEN_ADDRESS and NEXT_PUBLIC_THIRDWEB_CLIENT_ID to enable payments.
      </div>
    );
  }

  const buy = async () => {
    if (!token) return;
    const [symbol, decimals] = token;
    setIsPaying(true);
    try {
      if (chainId !== X402_CHAIN.id) await switchChainAsync({ chainId: X402_CHAIN.id });
      if (!walletClient) throw new Error(`Connect a wallet on ${X402_CHAIN.name}`);
      // Created here rather than at module scope, where a missing client ID would throw during prerender.
      const thirdwebClient = createThirdwebClient({ clientId: THIRDWEB_CLIENT_ID });
      // createWalletAdapter wraps the already-connected wagmi account. (viemAdapter.wallet.fromViem
      // returns a disconnected wallet, and wrapFetchWithPayment throws "Wallet not connected".)
      const wallet = createWalletAdapter({
        client: thirdwebClient,
        adaptedAccount: viemAdapter.walletClient.fromViem({
          walletClient: walletClient as unknown as ThirdwebViemWalletClient,
        }),
        chain: defineChain(X402_CHAIN.id),
        onDisconnect: () => {},
        switchChain: () => {},
      });
      // Refuse to pay more than the advertised price.
      const maxValue = parseUnits(X402_PRICE, decimals);
      const fetchWithPayment = wrapFetchWithPayment(fetch, thirdwebClient, wallet, { maxValue });
      const res = await fetchWithPayment("/api/premium");
      if (!res.ok) throw new Error(`Payment failed (${res.status})`);
      setData(await res.json());
      notification.success(`Paid ${X402_PRICE} ${symbol}`);
    } catch (e) {
      notification.error(getParsedError(e));
    } finally {
      setIsPaying(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 pt-10">
      <button className="btn btn-primary" onClick={buy} disabled={isPaying || !token}>
        {isPaying || !token ? <span className="loading loading-spinner" /> : `Unlock for ${X402_PRICE} ${token[0]}`}
      </button>
      {data !== undefined && <pre className="bg-base-200 rounded-box p-4">{JSON.stringify(data, null, 2)}</pre>}
    </div>
  );
};

export default Premium;
