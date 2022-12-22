import { NgModule } from '@angular/core';
import { NgxEchartsModule } from 'ngx-echarts';
import { StacksRoutingModule} from '../stacks/stacks.routing.module';
import { SharedModule } from '../shared/shared.module';
import { StacksMasterPageComponent } from '../components/stacks-master-page/stacks-master-page.component';
import { CommonModule } from '@angular/common';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { MultiSelectSearchFilter } from '../components/ngx-bootstrap-multiselect/search-filter.pipe';
import { AutofocusDirective } from '../components/ngx-bootstrap-multiselect/autofocus.directive';
import { OffClickDirective } from '../components/ngx-bootstrap-multiselect/off-click.directive';
import { DashboardComponent } from '../dashboard/dashboard.component';
import { MempoolBlockComponent } from '../components/mempool-block/mempool-block.component';
import { GraphsModule } from '../graphs/graphs.module';
import { StacksBlockchainComponent } from '../stacks/stacks-blockchain/stacks-blockchain.component';
import { StacksDashboardComponent } from '../stacks/stacks-dashboard/stacks-dashboard.component';
import { StacksStartComponent } from '../stacks/stacks-start/stacks-start.component';
import { StacksBlockchainBlocksComponent } from '../stacks/stacks-blockchain-blocks/stacks-blockchain-blocks.component';
import { StacksMempoolBlocksComponent } from '../stacks/stacks-mempool-blocks/stacks-mempool-blocks.component';
import { StacksApiService } from './stacks-api.service';
import { StacksFeesBoxComponent } from '../stacks/stacks-fees-box/stacks-fees-box.component';
import { StacksMempoolGraphComponent } from '../stacks/stacks-mempool-graph/stacks-mempool-graph.component';
import { StacksIncomingTransactionsGraphComponent } from '../stacks/stacks-incoming-transactions-graph/stacks-incoming-transactions-graph.component';

@NgModule({
  declarations: [
    StacksMasterPageComponent,
    StacksDashboardComponent,
    StacksBlockchainComponent,
    StacksStartComponent,
    StacksBlockchainBlocksComponent,
    StacksMempoolBlocksComponent,
    StacksFeesBoxComponent,
    StacksMempoolGraphComponent,
    StacksIncomingTransactionsGraphComponent
  ],
  imports: [
    CommonModule,
    // GraphsModule,
    StacksRoutingModule,
    SharedModule,
    FontAwesomeModule,
    NgxEchartsModule.forRoot({
      echarts: () => import('echarts')
    })
  ],
  providers: [
    StacksApiService,
    MultiSelectSearchFilter,
    AutofocusDirective,
    OffClickDirective,
  ],
  exports: [
    NgxEchartsModule,
  ]
})

export class StacksModule {}