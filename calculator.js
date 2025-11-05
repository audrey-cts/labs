class Calculator {
    constructor(previousOperandElement, currentOperandElement) {
        this.previousOperandElement = previousOperandElement;
        this.currentOperandElement = currentOperandElement;
        this.clear();
    }

    clear() {
        this.currentOperand = '0';
        this.previousOperand = '';
        this.operation = undefined;
        this.shouldResetScreen = false;
    }

    delete() {
        if (this.currentOperand === '0') return;
        if (this.currentOperand.length === 1) {
            this.currentOperand = '0';
        } else {
            this.currentOperand = this.currentOperand.slice(0, -1);
        }
    }

    appendNumber(number) {
        if (this.shouldResetScreen) {
            this.currentOperand = '0';
            this.shouldResetScreen = false;
        }

        if (number === '.' && this.currentOperand.includes('.')) return;

        if (this.currentOperand === '0' && number !== '.') {
            this.currentOperand = number;
        } else {
            this.currentOperand += number;
        }
    }

    chooseOperation(operation) {
        if (this.currentOperand === '') return;

        if (this.previousOperand !== '') {
            this.compute();
        }

        this.operation = operation;
        this.previousOperand = this.currentOperand + ' ' + operation;
        this.currentOperand = '0';
    }

    compute() {
        let computation;
        const prev = parseFloat(this.previousOperand);
        const current = parseFloat(this.currentOperand);

        if (isNaN(prev) || isNaN(current)) return;

        switch (this.operation) {
            case '+':
                computation = prev + current;
                break;
            case '-':
                computation = prev - current;
                break;
            case '×':
                computation = prev * current;
                break;
            case '÷':
                if (current === 0) {
                    alert('不能除以零！');
                    this.clear();
                    this.updateDisplay();
                    return;
                }
                computation = prev / current;
                break;
            default:
                return;
        }

        this.currentOperand = this.roundResult(computation).toString();
        this.operation = undefined;
        this.previousOperand = '';
        this.shouldResetScreen = true;
    }

    roundResult(number) {
        return Math.round((number + Number.EPSILON) * 100000000) / 100000000;
    }

    percent() {
        const current = parseFloat(this.currentOperand);
        if (isNaN(current)) return;
        this.currentOperand = (current / 100).toString();
    }

    getDisplayNumber(number) {
        const stringNumber = number.toString();
        const integerDigits = parseFloat(stringNumber.split('.')[0]);
        const decimalDigits = stringNumber.split('.')[1];
        let integerDisplay;

        if (isNaN(integerDigits)) {
            integerDisplay = '';
        } else {
            integerDisplay = integerDigits.toLocaleString('en', {
                maximumFractionDigits: 0
            });
        }

        if (decimalDigits != null) {
            return `${integerDisplay}.${decimalDigits}`;
        } else {
            return integerDisplay;
        }
    }

    updateDisplay() {
        this.currentOperandElement.textContent = this.getDisplayNumber(this.currentOperand);
        this.previousOperandElement.textContent = this.previousOperand;
    }
}

// 初始化計算器
const previousOperandElement = document.getElementById('previousOperand');
const currentOperandElement = document.getElementById('currentOperand');
const calculator = new Calculator(previousOperandElement, currentOperandElement);

// 數字按鈕事件監聽
document.querySelectorAll('.button.number').forEach(button => {
    button.addEventListener('click', () => {
        calculator.appendNumber(button.dataset.number);
        calculator.updateDisplay();
    });
});

// 運算符按鈕事件監聽
document.querySelectorAll('.button.operator').forEach(button => {
    button.addEventListener('click', () => {
        calculator.chooseOperation(button.dataset.operator);
        calculator.updateDisplay();
    });
});

// 等號按鈕事件監聽
document.getElementById('equals').addEventListener('click', () => {
    calculator.compute();
    calculator.updateDisplay();
});

// 清除按鈕事件監聽
document.getElementById('clear').addEventListener('click', () => {
    calculator.clear();
    calculator.updateDisplay();
});

// 刪除按鈕事件監聽
document.getElementById('delete').addEventListener('click', () => {
    calculator.delete();
    calculator.updateDisplay();
});

// 百分比按鈕事件監聽
document.getElementById('percent').addEventListener('click', () => {
    calculator.percent();
    calculator.updateDisplay();
});

// 鍵盤事件監聽
document.addEventListener('keydown', (event) => {
    if (event.key >= 0 && event.key <= 9) {
        calculator.appendNumber(event.key);
        calculator.updateDisplay();
    }
    if (event.key === '.') {
        calculator.appendNumber(event.key);
        calculator.updateDisplay();
    }
    if (event.key === 'Enter' || event.key === '=') {
        calculator.compute();
        calculator.updateDisplay();
    }
    if (event.key === 'Backspace') {
        calculator.delete();
        calculator.updateDisplay();
    }
    if (event.key === 'Escape') {
        calculator.clear();
        calculator.updateDisplay();
    }
    if (event.key === '+' || event.key === '-') {
        calculator.chooseOperation(event.key);
        calculator.updateDisplay();
    }
    if (event.key === '*') {
        calculator.chooseOperation('×');
        calculator.updateDisplay();
    }
    if (event.key === '/') {
        event.preventDefault();
        calculator.chooseOperation('÷');
        calculator.updateDisplay();
    }
    if (event.key === '%') {
        calculator.percent();
        calculator.updateDisplay();
    }
});
