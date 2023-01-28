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
import { StacksBlockchainComponent } from '../stacks/stacks-blockchain/stacks-blockchain.component';
import { StacksDashboardComponent } from '../stacks/stacks-dashboard/stacks-dashboard.component';
import { StacksStartComponent } from '../stacks/stacks-start/stacks-start.component';
import { StacksBlockchainBlocksComponent } from '../stacks/stacks-blockchain-blocks/stacks-blockchain-blocks.component';
import { StacksMempoolBlocksComponent } from '../stacks/stacks-mempool-blocks/stacks-mempool-blocks.component';
import { StacksApiService } from './stacks-api.service';
import { StacksFeesBoxComponent } from '../stacks/stacks-fees-box/stacks-fees-box.component';
import { StacksMempoolGraphComponent } from '../stacks/stacks-mempool-graph/stacks-mempool-graph.component';
import { StacksIncomingTransactionsGraphComponent } from '../stacks/stacks-incoming-transactions-graph/stacks-incoming-transactions-graph.component';
import { StacksBlockComponent } from '../stacks/stacks-block/stacks-block.component';
import { StacksBlockOverviewTooltipComponent} from '../stacks/stacks-block-overview-tooltip/stacks-block-overview-tooltip.component';
import { StacksBlockOverviewGraphComponent } from '../stacks/stacks-block-overview-graph/stacks-block-overview-graph.component';
import { StacksFiatComponent } from '../stacks/stacks-fiat/stacks-fiat.component';
import { StacksTransactionsListComponent } from '../stacks/stacks-transactions-list/stacks-transactions-list.component';
import { StacksAmountComponent } from '../stacks/stacks-amount/stacks-amount.component';
import { StacksMempoolBlockComponent } from '../stacks/stacks-mempool-block/stacks-mempool-block.component';
import { StacksFeeDistributionGraphComponent } from '../stacks/stacks-fee-distribution-graph/stacks-fee-distribution-graph.component';
import { StacksMempoolBlockOverviewComponent } from '../stacks/stacks-mempool-block-overview/stacks-mempool-block-overview.component';
import { ExecutionCostsGraph } from '../stacks/execution-costs-graph/execution-costs-graph.component';
import { StacksTransactionComponent } from '../stacks/stacks-transaction/stacks-transaction.component';
import { BytesPipe } from '../shared/pipes/bytes-pipe/bytes.pipe';
import { StacksAddressComponent } from './stacks-address/stacks-address.component';
import { StacksSearchFormComponent } from './stacks-search-form/stacks-search-form.component';
import { StacksSearchResultsComponent } from './stacks-search-form/search-results/stacks-search-results.component';



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
    StacksIncomingTransactionsGraphComponent,
    StacksBlockComponent,
    StacksBlockOverviewTooltipComponent,
    StacksBlockOverviewGraphComponent,
    StacksFiatComponent,
    StacksTransactionsListComponent,
    StacksAmountComponent,
    StacksMempoolBlockComponent,
    StacksFeeDistributionGraphComponent,
    StacksMempoolBlockOverviewComponent,
    ExecutionCostsGraph,
    StacksTransactionComponent,
    StacksAddressComponent,
    StacksSearchFormComponent,
    StacksSearchResultsComponent
  ],
  imports: [
    CommonModule,
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
    BytesPipe
  ],
  exports: [
    NgxEchartsModule,
  ]
})

export class StacksModule {}