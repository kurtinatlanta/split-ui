import { useState } from 'react';
import { useAppStore } from '../../store';
import type { IntentDefinition } from '../types';

function IssueBonusUI() {
    const { currentIntent, clearIntent, addMessage } = useAppStore();

    const entities = currentIntent?.entities || {};
    const [employeeName, setEmployeeName] = useState((entities.employeeName as string) || '');
    const [amount, setAmount] = useState((entities.amount as string) || '');
    const [reason, setReason] = useState((entities.reason as string) || '');

    const handleIssue = () => {
        // In a real app, this would call an API
        console.log('Issuing bonus:', { employeeName, amount, reason });

        addMessage(
            'assistant',
            `Bonus of $${amount} has been issued to ${employeeName} for "${reason || 'performance'}".`
        );
        clearIntent();
    };

    return (
        <div className="issue-bonus-ui">
            <h3>Issue Bonus</h3>
            <div className="form-field">
                <label>Employee Name</label>
                <input
                    type="text"
                    value={employeeName}
                    onChange={(e) => setEmployeeName(e.target.value)}
                    placeholder="e.g. Alice Smith"
                />
            </div>
            <div className="form-field">
                <label>Amount ($)</label>
                <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 500"
                />
            </div>
            <div className="form-field">
                <label>Reason</label>
                <input
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g. Outstanding performance"
                />
            </div>
            <button onClick={handleIssue} className="primary">
                Issue Bonus
            </button>
            <button onClick={clearIntent} className="secondary">
                Cancel
            </button>
        </div>
    );
}

export const issueBonus: IntentDefinition = {
    name: 'issue_bonus',
    description: 'Issue a monetary bonus to an employee',
    component: IssueBonusUI,
    entities: {
        type: 'object',
        properties: {
            employeeName: {
                type: 'string',
                description: 'Name of the employee receiving the bonus',
            },
            amount: {
                type: 'number',
                description: 'Amount of the bonus in dollars',
            },
            reason: {
                type: 'string',
                description: 'Reason for the bonus',
            },
        },
        required: ['employeeName', 'amount'],
    },
};
