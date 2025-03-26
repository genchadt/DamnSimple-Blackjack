// ./game/Card.ts
export enum Suit {
    Hearts = "Hearts",
    Diamonds = "Diamonds",
    Clubs = "Clubs",
    Spades = "Spades"
}

export enum Rank {
    Two = "2",
    Three = "3",
    Four = "4",
    Five = "5",
    Six = "6",
    Seven = "7",
    Eight = "8",
    Nine = "9",
    Ten = "10",
    Jack = "J",
    Queen = "Q",
    King = "K",
    Ace = "A"
}

export class Card {
    private suit: Suit;
    private rank: Rank;
    private faceUp: boolean;

    /**
     * Creates a new instance of the Card class.
     * 
     * @param {Suit} suit - The suit of the card.
     * @param {Rank} rank - The rank of the card.
     * 
     * The card is initially face down.
     */
    constructor(suit: Suit, rank: Rank) {
        this.suit = suit;
        this.rank = rank;
        this.faceUp = false;
    }

    /**
     * Gets the suit of the card.
     * 
     * @returns {Suit} The suit of the card.
     */
    public getSuit(): Suit {
        return this.suit;
    }

    /**
     * Gets the rank of the card.
     * 
     * @returns {Rank} The rank of the card.
     */
    public getRank(): Rank {
        return this.rank;
    }

    /**
     * Determines if the card is face up.
     * 
     * @returns {boolean} - true if the card is face up, false if it is face down.
     */
    public isFaceUp(): boolean {
        return this.faceUp;
    }

    /**
     * Sets the face up state of the card.
     * 
     * @param {boolean} value - true if the card should be face up, false if it should be face down.
     */
    public setFaceUp(value: boolean): void {
        this.faceUp = value;
    }

    /**
     * Flips the card face up or face down.
     * This function calls any registered callbacks with the card instance as an argument.
     */
    public flip(): void {
        this.faceUp = !this.faceUp;
        // Notify any listeners that the card was flipped
        if (this.onFlip) {
            this.onFlip(this);
        }
    }

    /**
     * Callback function to be called when the card is flipped.
     * This function receives the card instance as an argument.
     */
    public onFlip: ((card: Card) => void) | null = null;

    /**
     * Registers a callback function to be called when the card is flipped.
     * The callback receives the card instance as an argument.
     * 
     * @param {((card: Card) => void)} callback - The function to be called when the card is flipped.
     */
    public setFlipCallback(callback: (card: Card) => void): void {
        this.onFlip = callback;
    }

    /**
     * Calculates the value of the card according to Blackjack rules.
     * Aces are valued at 11, Jacks, Queens, and Kings are valued at 10, and all other cards are valued at their rank.
     * 
     * @returns {number} The value of the card.
     */
    public getValue(): number {
        switch (this.rank) {
            case Rank.Ace:
                return 11; // Aces are 11 or 1 in Blackjack
            case Rank.Jack:
            case Rank.Queen:
            case Rank.King:
                return 10;
            default:
                return parseInt(this.rank);
        }
    }

    /**
     * Returns a string representation of the card, including its rank and suit.
     * 
     * @returns {string} A string in the format "Rank of Suit".
     */
    public toString(): string {
        return `${this.rank} of ${this.suit}`;
    }

}
