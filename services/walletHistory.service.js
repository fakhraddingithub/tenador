import "base/models/registerModels";
import ReviewCreditTransaction from "base/models/ReviewCreditTransaction";
import CoachWalletTransaction from "base/models/CoachWalletTransaction";
import WalletTransaction from "base/models/WalletTransaction";

export async function getWalletHistory(userId) {
  const [reviews, coaches, wallet] = await Promise.all([
    ReviewCreditTransaction.find({ user: userId }).select("amount createdAt").sort({ createdAt: -1 }).limit(50).lean(),
    CoachWalletTransaction.find({ coach: userId }).select("amount createdAt").sort({ createdAt: -1 }).limit(50).lean(),
    WalletTransaction.find({ user: userId }).select("type amount description createdAt").sort({ createdAt: -1 }).limit(50).lean(),
  ]);
  return [...wallet,
    ...reviews.map(tx => ({ ...tx, type: "credit", description: "پاداش نظر تأییدشده" })),
    ...coaches.map(tx => ({ ...tx, type: "credit", description: "واریز از کردیت خرید شاگرد" })),
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 50);
}
