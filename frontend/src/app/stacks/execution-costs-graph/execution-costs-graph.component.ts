import { Component, Input, OnChanges, OnInit } from '@angular/core';

@Component({
  selector: 'app-execution-costs-graph',
  templateUrl: './execution-costs-graph.component.html',
  styleUrls: ['./execution-costs-graph.component.scss'],
})
export class ExecutionCostsGraph implements OnChanges {
  @Input() readCount: number;
  @Input() readLength: number;
  @Input() runtime: number;
  @Input() writeCount: number;
  @Input() writeLength: number;
  runtimeLimit: number = 5000000000;
  readCountLimit: number = 15000;
  readLengthLimit: number = 100000000;
  writeCountLimit: number = 15000;
  writeLengthLimit: number = 15000000;
  showGraph = false;

  options: any;
  constructor() { }

  ngOnChanges(): void {
    this.showGraph = false;
    const xAxisData = ['Runtime', 'Read Count', 'Read Length', 'Write Count', 'Write Length'];
    this.options = {
      xAxis: {
        data: xAxisData,
        type: 'category',
        axisTick: {
          alignWithLabel: true
        }
      },
      yAxis: {
        type: 'value',
        name: '% Used of Block Execution Capacity',
        nameLocation: 'middle',
        nameTextStyle: {
          padding: [0, 0, 10, 0]
        },
        axisLabel: {
          fontSize: 11,
        },
        splitLine: {
          lineStyle: {
            type: 'dotted',
            color: '#ffffff66',
            opacity: 0.25,
          }
        }
      },
      series: [
        {
          type: 'bar',
          data: [this.runtime / this.runtimeLimit * 100, this.readCount / this.readCountLimit * 100, this.readLength / this.readLengthLimit * 100, this.writeCount / this.writeCountLimit * 100, this.writeLength / this.writeLengthLimit * 100],
          animationDelay: (idx) => idx * 10,
        },
      ],
      visualMap: {
        show: false,
        type: 'piecewise',
        top: 50,
        right: 10,
        pieces: [{
          gt: 0,
          lte: 20,
          color: '#7CB342'
        },
        {
          gt: 20,
          lte: 50,
          color: '#FDD835'
        },
        {
          gt: 50,
          lte: 75,
          color: '#FFB300'
        },
        {
          gt: 75,
          lte: 85,
          color: '#FB8C00'
        },
        {
          gt: 85,
          lte: 95,
          color: '#F4511E'
        },
        {
          gt: 95,
          color: '#D81B60'
        }],
        outOfRange: {
          color: '#999'
        }
      },
      animationEasing: 'elasticOut',
      animationDelayUpdate: (idx) => idx * 5,
    };
    this.showGraph = true;
  }
}