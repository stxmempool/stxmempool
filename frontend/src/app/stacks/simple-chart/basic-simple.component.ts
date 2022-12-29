import { Component, Input, OnInit } from '@angular/core';

@Component({
  selector: 'app-basic-simple',
  templateUrl: './basic-simple.component.html',
  styleUrls: ['./basic-simple.component.scss'],
})
export class BasicSimpleComponent implements OnInit {
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

  options: any;
  constructor() { }

  ngOnInit(): void {
    const xAxisData = ['Runtime', 'Read Count', 'Read Length', 'Write Count', 'Write Length'];
    const data1 = [];
    const data2 = [];
    console.log([this.runtime, this.readCount, this.readLength, this.writeCount, this.writeLength])

    // for (let i = 0; i < 100; i++) {
    //   xAxisData.push('category' + i);
    //   data1.push((Math.sin(i / 5) * (i / 5 - 10) + i / 6) * 5);
    //   data2.push((Math.cos(i / 5) * (i / 5 - 10) + i / 6) * 5);
    // }

    this.options = {
      // legend: {
      //   data: ['bar', 'bar2'],
      //   align: 'left',
      // },
      // tooltip: {},
      // xAxis: {
      //   data: xAxisData,
      //   silent: false,
      //   splitLine: {
      //     show: false,
      //   },
      // },
      xAxis: {
        data: xAxisData,
        type: 'category',
        // silent: false,
        // splitLine: {
        //   show: false,
        // },
      },
      yAxis: {
        type: 'value',
        name: '% Used of Block Execution Capacity',
        nameLocation: 'middle',
        nameTextStyle: {
          // backgroundColor: 'red',
          padding: [0, 0, 10, 0]
        }
      },
      series: [
        {
          // name: 'bar',
          type: 'bar',
          // data: data1,
          data: [this.runtime / this.runtimeLimit * 100, this.readCount / this.readCountLimit * 100, this.readLength / this.readLengthLimit * 100, this.writeCount / this.writeCountLimit * 100, this.writeLength / this.writeLengthLimit * 100],
          animationDelay: (idx) => idx * 10,
        },
        // {
        //   name: 'bar2',
        //   type: 'bar',
        //   data: data2,
        //   animationDelay: (idx) => idx * 10 + 100,
        // },
      ],
      animationEasing: 'elasticOut',
      animationDelayUpdate: (idx) => idx * 5,
    };
    console.log(this.options);
  }
}