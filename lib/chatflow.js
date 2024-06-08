export const chatFlowGraph = {
    start: {
        id: 'start',
        message: `Hello, I'm Saed, a real estate agent at DSS Consulting in Dubai. I've received your inquiry regarding investing in Dubai. May I have your full name?`,
        next: 'language'
    },
    language: {
        id: 'language',
        message: 'In what language do you want to continue the discussion?',
        next: 'greeting'
    },
    greeting: {
        id: 'greeting',
        message: 'Pleased [Client Name], I am here to support you. How can I help you?',
        next: 'budget'
    },
    budget: {
        id: 'budget',
        message: 'What is your total budget for the purchase of this property?',
        next: 'monthlyPayment'
    },
    monthlyPayment: {
        id: 'monthlyPayment',
        message: 'It’s a good budget to invest in Dubai. How much are you able to pay monthly under a payment plan?',
        next: 'downPayment'
    },
    downPayment: {
        id: 'downPayment',
        message: 'Thank you. What down payment do you want to dedicate to this investment?',
        next: 'residenceOrInvestment'
    },
    residenceOrInvestment: {
        id: 'residenceOrInvestment',
        message: 'Are you seeking a primary residence or an investment property?',
        next: 'propertyType'
    },
    propertyType: {
        id: 'propertyType',
        message: 'Would you like to invest in an apartment or villa?',
        next: 'rooms'
    },
    rooms: {
        id: 'rooms',
        message: 'How many rooms do you want?',
        next: 'investmentPurpose'
    },
    investmentPurpose: {
        id: 'investmentPurpose',
        message: 'Is this an investment for rental purposes, or are you looking to do a flip (purchase and resale after delivery with added value)?',
        next: 'purchaseTime'
    },
    purchaseTime: {
        id: 'purchaseTime',
        message: 'When do you plan to purchase?',
        next: 'knowDubai'
    },
    knowDubai: {
        id: 'knowDubai',
        message: 'Do you know Dubai?',
        next: 'criteria'
    },
    criteria: {
        id: 'criteria',
        message: 'What are the criteria that you absolutely want found in your property?',
        next: 'realEstateProgram'
    },
    realEstateProgram: {
        id: 'realEstateProgram',
        message: 'Do you have a specific real estate program in mind, or would you like suggestions based on your criteria?',
        next: 'end'
    },
    end: {
        id: 'end',
        message: 'Thank you for your responses. We will get back to you shortly with more details.',
        next: null
    }
};
