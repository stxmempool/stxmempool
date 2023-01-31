import { Component, ElementRef, ViewChild, Input, OnChanges, ChangeDetectionStrategy } from '@angular/core';
import { Position } from '../../components/block-overview-graph/sprite-types.js';
import { StacksTransactionStripped } from '../stacks.interfaces';

@Component({
  selector: 'app-stacks-block-overview-tooltip',
  templateUrl: './stacks-block-overview-tooltip.component.html',
  styleUrls: ['./stacks-block-overview-tooltip.component.scss'],
})
export class StacksBlockOverviewTooltipComponent implements OnChanges {
  @Input() tx: StacksTransactionStripped | void;

  @Input() cursorPosition: Position;
  @Input() clickable: boolean;

  txid = '';
  fee = 0;
  value = 0;
  size = 1;
  feeRate = 0;
  readCount = 0;

  tooltipPosition: Position = { x: 0, y: 0 };

  @ViewChild('tooltip') tooltipElement: ElementRef<HTMLCanvasElement>;

  constructor() {}

  ngOnChanges(changes): void {
    if (changes.cursorPosition && changes.cursorPosition.currentValue) {
      let x = changes.cursorPosition.currentValue.x + 10;
      let y = changes.cursorPosition.currentValue.y + 10;
      if (this.tooltipElement) {
        const elementBounds = this.tooltipElement.nativeElement.getBoundingClientRect();
        const parentBounds = this.tooltipElement.nativeElement.offsetParent.getBoundingClientRect();
        if ((parentBounds.left + x + elementBounds.width) > parentBounds.right) {
          x = Math.max(0, parentBounds.width - elementBounds.width - 10);
        }
        if (y + elementBounds.height > parentBounds.height) {
          y = y - elementBounds.height - 20;
        }
      }
      this.tooltipPosition = { x, y };
    }

    if (changes.tx) {
      const tx = changes.tx.currentValue || {};
      this.txid = tx.txid || '';
      this.fee = tx.fee || 0;
      this.value = tx.value || 0;
      this.size = tx.size || 1;
      this.feeRate = this.fee / this.size;
      this.readCount = tx.execution_cost_read_count;
    }
  }
  convertTxType(txType: string | number): string {
    if (typeof txType === 'number') {
      txType.toString().replace('_', ' ');
    } else {
      return txType.replace('_', ' ');
    }
  }
}
