import { settlePayment } from "thirdweb/x402";
import { X402_PRICE } from "~~/services/x402/config";
import { X402_NETWORK, payTo, thirdwebFacilitator, x402Price } from "~~/services/x402/server";

export async function GET(request: Request) {
  const result = await settlePayment({
    resourceUrl: request.url,
    method: "GET",
    paymentData: request.headers.get("PAYMENT-SIGNATURE") ?? request.headers.get("X-PAYMENT"),
    payTo,
    network: X402_NETWORK,
    price: await x402Price(X402_PRICE),
    facilitator: thirdwebFacilitator,
  });

  if (result.status !== 200) {
    return Response.json(result.responseBody, { status: result.status, headers: result.responseHeaders });
  }

  return Response.json({ data: "premium content" }, { headers: result.responseHeaders });
}
