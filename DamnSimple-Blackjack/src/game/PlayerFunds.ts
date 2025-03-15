// game/PlayerFunds.ts
export class PlayerFunds {
    private static readonly STORAGE_KEY = "damnSimpleBlackjack_funds";
    private static readonly DEFAULT_FUNDS = 1000;
    private funds: number;

    constructor() {
        this.funds = this.loadFunds();
    }

    public getFunds(): number {
        return this.funds;
    }

    public addFunds(amount: number): void {
        this.funds += amount;
        this.saveFunds();
    }

    public deductFunds(amount: number): boolean {
        if (amount > this.funds) return false;
        this.funds -= amount;
        this.saveFunds();
        return true;
    }

    public resetFunds(): void {
        this.funds = PlayerFunds.DEFAULT_FUNDS;
        this.saveFunds();
    }

    private loadFunds(): number {
        const storedFunds = localStorage.getItem(PlayerFunds.STORAGE_KEY);
        return storedFunds ? parseInt(storedFunds) : PlayerFunds.DEFAULT_FUNDS;
    }

    private saveFunds(): void {
        localStorage.setItem(PlayerFunds.STORAGE_KEY, this.funds.toString());
    }
}
