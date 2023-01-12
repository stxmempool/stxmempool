import { Component, OnInit, ChangeDetectionStrategy, Input } from '@angular/core';
import { Observable } from 'rxjs';
import { StateService } from '../../services/state.service';

@Component({
  selector: 'app-stacks-fiat',
  templateUrl: './stacks-fiat.component.html',
  styleUrls: ['./stacks-fiat.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StacksFiatComponent implements OnInit {
  conversions$: Observable<any>;

  // @Input() value: number | string;
  @Input() value: number;

  @Input() digitsInfo = '1.2-2';
  // @Input() digitsInfo = '1.0-1';


  constructor(
    private stateService: StateService,
  ) { }

  ngOnInit(): void {
    // if (this.value === typeof 'string') {
    //   this.value = Number(this.value);
    // }
    this.conversions$ = this.stateService.conversions$.asObservable();
  }

}
