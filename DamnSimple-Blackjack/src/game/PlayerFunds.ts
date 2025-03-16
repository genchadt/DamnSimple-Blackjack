// game/PlayerFunds.ts
export class PlayerFunds {
    private static readonly STORAGE_KEY = "damnSimpleBlackjack_funds";
    private static readonly DEFAULT_FUNDS = 1000;
    private funds: number;

    /**
     * Creates a new PlayerFunds object, loading the player's saved funds or using the default if no saved funds exist.
     */
    constructor() {
        this.funds = this.loadFunds();
    }

    /**
     * Retrieves the player's current funds.
     * 
     * @returns {number} The player's current funds.
     */
    public getFunds(): number {
        return this.funds;
    }

    /**
     * Adds the given amount to the player's funds, and saves the new amount to local storage.
     * 
     * @param {number} amount The amount to add to the player's funds.
     */
    public addFunds(amount: number): void {
        this.funds += amount;
        this.saveFunds();
    }

    /**
     * Deducts the specified amount from the player's funds if sufficient funds are available.
     * Saves the updated funds to local storage.
     * 
     * @param {number} amount - The amount to deduct from the player's funds.
     * @returns {boolean} - Returns true if the deduction was successful, otherwise false.
     */
    public deductFunds(amount: number): boolean {
        if (amount > this.funds) return false;
        this.funds -= amount;
        this.saveFunds();
        return true;
    }

    /**
     * Resets the player's funds to the default amount, and saves the updated funds to local storage.
     */
    public resetFunds(): void {
        this.funds = PlayerFunds.DEFAULT_FUNDS;
        this.saveFunds();
    }

    /**
     * Loads the player's funds from local storage, returning the default funds
     * value if no stored value is found.
     * 
     * @returns {number} The player's current funds.
     */
    private loadFunds(): number {
        const storedFunds = localStorage.getItem(PlayerFunds.STORAGE_KEY);
        return storedFunds ? parseInt(storedFunds) : PlayerFunds.DEFAULT_FUNDS;
    }

    /**
     * Saves the player's current funds to local storage.
     * This method updates the locally stored funds value with the current funds.
     */
    private saveFunds(): void {
        localStorage.setItem(PlayerFunds.STORAGE_KEY, this.funds.toString());
    }
}
