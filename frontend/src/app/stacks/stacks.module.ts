import { NgModule } from '@angular/core';
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
import { StacksDashboardComponent } from '../stacks/stacks-dashboard/stacks-dashboard.component';
import { StacksApiService } from './stacks-api.service';

@NgModule({
  declarations: [
    StacksMasterPageComponent,
    StacksDashboardComponent,
  ],
  imports: [
    CommonModule,
    // GraphsModule,
    StacksRoutingModule,
    SharedModule,
    FontAwesomeModule
  ],
  providers: [
    StacksApiService,
    MultiSelectSearchFilter,
    AutofocusDirective,
    OffClickDirective,
  ]
  
})

export class StacksModule {}